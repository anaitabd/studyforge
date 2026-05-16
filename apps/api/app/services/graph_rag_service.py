"""
Graph RAG: extracts concepts from documents, builds a knowledge graph,
and enhances RAG queries with graph-traversal context.
"""
import logging
from typing import Any
import networkx as nx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_graph import KnowledgeConcept, ConceptRelation
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)


# ── Concept extraction ─────────────────────────────────────────────────────────

_EXTRACT_SCHEMA = (
    "object with: concepts (array of objects, each with: "
    "name (string, the concept name in the document's language), "
    "definition (string, 1-2 sentence definition), "
    "formula (string or null, LaTeX formula if applicable), "
    "related_to (array of concept names this concept requires or applies))"
)


async def extract_concepts_from_text(
    text: str,
    subject: str,
    level: str | None,
    language: str = "fr",
) -> dict:
    """
    Given a text chunk, extract academic concepts and their relationships.
    Returns structured JSON ready to insert into knowledge_concepts.
    """
    lang_note = {"fr": "in French", "ar": "in Arabic", "en": "in English"}.get(language, "")

    prompt = (
        f"You are analyzing a Moroccan {level or ''} {subject} educational document {lang_note}.\n\n"
        "Extract all academic concepts from this text. A concept is:\n"
        "- A theorem, formula, or mathematical property\n"
        "- A definition (e.g. 'probabilité conditionnelle', 'variable aléatoire')\n"
        "- A technique or method (e.g. 'tirage sans remise', 'calcul d\\'espérance')\n\n"
        "For each concept:\n"
        "- name: the exact term used in the document\n"
        "- definition: 1-2 sentence explanation a student could read\n"
        "- formula: LaTeX string if it involves a formula (e.g. P(A|B) = \\\\frac{P(A \\\\cap B)}{P(B)}), else null\n"
        "- related_to: list of OTHER concept names from this same text that this concept requires or uses\n\n"
        "Only extract concepts explicitly present in the text. Do not invent.\n\n"
        f"TEXT:\n{text[:3000]}"
    )

    result = await ai_service.generate_structured_json(
        prompt=prompt,
        schema_description=_EXTRACT_SCHEMA,
        max_tokens=2000,
    )

    if isinstance(result, dict) and "concepts" in result:
        return result
    return {"concepts": []}


# ── Graph builder ─────────────────────────────────────────────────────────────

async def build_graph_for_file(
    db: AsyncSession,
    file_id: str,
    org_id: str | None,
    user_id: str,
    text_pages: list[dict],   # [{page_number, text}, ...]
    subject: str,
    level: str | None,
    chunk_id_map: dict[int, str],  # page_number → chromadb chunk_id
) -> int:
    """
    Extracts concepts from all pages of a file and saves them with relationships.
    Returns the number of concepts created.
    """
    all_concepts: dict[str, dict] = {}   # name → concept data
    all_relations: list[tuple[str, str]] = []  # (source_name, target_name)

    # Process pages in batches of 3 to stay within token limits
    for i in range(0, len(text_pages), 3):
        batch = text_pages[i:i + 3]
        combined = "\n\n---\n\n".join(p["text"] for p in batch if p.get("text"))
        if not combined.strip():
            continue

        extracted = await extract_concepts_from_text(combined, subject, level)
        for concept in extracted.get("concepts", []):
            name = concept.get("name", "").strip()
            if not name or len(name) < 3:
                continue
            if name not in all_concepts:
                all_concepts[name] = concept
                all_concepts[name]["chunk_ids"] = [
                    chunk_id_map.get(p["page_number"]) for p in batch
                    if chunk_id_map.get(p["page_number"])
                ]
            for related in concept.get("related_to", []):
                if related and related != name:
                    all_relations.append((name, related))

    # Persist concepts
    saved_ids: dict[str, str] = {}
    for name, data in all_concepts.items():
        existing = await db.execute(
            select(KnowledgeConcept).where(
                KnowledgeConcept.file_id == file_id,
                KnowledgeConcept.name == name,
            )
        )
        if existing.scalar_one_or_none():
            continue
        concept_obj = KnowledgeConcept(
            org_id=org_id,
            user_id=user_id,
            file_id=file_id,
            name=name,
            subject=subject,
            level=level,
            definition=data.get("definition", ""),
            formula=data.get("formula"),
            chunk_ids=data.get("chunk_ids", []),
        )
        db.add(concept_obj)
        await db.flush()
        saved_ids[name] = concept_obj.id

    # Persist relations
    for source_name, target_name in all_relations:
        source_id = saved_ids.get(source_name)
        target_id = saved_ids.get(target_name)
        if not source_id or not target_id:
            continue
        db.add(ConceptRelation(
            source_id=source_id,
            target_id=target_id,
            relation_type="requires",
        ))

    await db.commit()
    return len(saved_ids)


# ── Graph-augmented retrieval ─────────────────────────────────────────────────

async def get_concept_context(
    db: AsyncSession,
    query: str,
    org_id: str | None,
    user_id: str,
    subject: str | None = None,
    depth: int = 2,
) -> dict:
    """
    Find concepts related to the query and traverse the graph up to `depth` hops.
    Returns: {
      matched_concepts: [...],      # directly matching concepts
      prerequisite_concepts: [...], # what student needs to know first
      chunk_ids: [...]              # ChromaDB chunk IDs from all matched concepts
    }
    """
    filters = []
    if org_id:
        filters.append(KnowledgeConcept.org_id == org_id)
    else:
        filters.append(KnowledgeConcept.user_id == user_id)
    if subject:
        filters.append(KnowledgeConcept.subject == subject)

    concepts_result = await db.execute(select(KnowledgeConcept).where(*filters))
    all_concepts = concepts_result.scalars().all()

    if not all_concepts:
        return {"matched_concepts": [], "prerequisite_concepts": [], "chunk_ids": []}

    # Find concepts whose name appears in the query
    query_lower = query.lower()
    matched = [c for c in all_concepts if c.name.lower() in query_lower]

    # If no direct match, use keyword overlap
    if not matched:
        query_words = set(query_lower.split())
        matched = [
            c for c in all_concepts
            if len(set(c.name.lower().split()) & query_words) >= 1
        ]

    if not matched:
        return {"matched_concepts": [], "prerequisite_concepts": [], "chunk_ids": []}

    matched_ids = {c.id for c in matched}

    # Load relations and build NetworkX graph
    relations_result = await db.execute(
        select(ConceptRelation).where(
            ConceptRelation.source_id.in_([c.id for c in all_concepts])
        )
    )
    relations = relations_result.scalars().all()

    G = nx.DiGraph()
    id_to_concept = {c.id: c for c in all_concepts}
    for c in all_concepts:
        G.add_node(c.id, name=c.name, definition=c.definition, formula=c.formula)
    for r in relations:
        G.add_edge(r.source_id, r.target_id, type=r.relation_type)

    # BFS: find prerequisite concepts up to `depth` hops
    prerequisite_ids = set()
    for mid in matched_ids:
        if mid not in G:
            continue
        for node in nx.bfs_tree(G, mid, depth_limit=depth).nodes():
            if node not in matched_ids:
                prerequisite_ids.add(node)

    # Collect all relevant chunk IDs
    all_chunk_ids = []
    for c in matched + [id_to_concept[pid] for pid in prerequisite_ids if pid in id_to_concept]:
        all_chunk_ids.extend(c.chunk_ids or [])

    return {
        "matched_concepts": [
            {"name": c.name, "definition": c.definition, "formula": c.formula}
            for c in matched
        ],
        "prerequisite_concepts": [
            {"name": id_to_concept[pid].name, "definition": id_to_concept[pid].definition}
            for pid in prerequisite_ids if pid in id_to_concept
        ],
        "chunk_ids": list(set(filter(None, all_chunk_ids))),
    }


class GraphRagService:
    async def augment_query(
        self,
        db: AsyncSession,
        query: str,
        org_id: str | None,
        user_id: str,
        subject: str | None = None,
        depth: int = 2,
    ) -> dict:
        return await get_concept_context(db, query, org_id, user_id, subject, depth)

    async def build_for_file(
        self,
        db: AsyncSession,
        file_id: str,
        org_id: str | None,
        user_id: str,
        pages: list[dict],
        subject: str,
        level: str | None,
        chunk_map: dict[int, str],
    ) -> int:
        return await build_graph_for_file(db, file_id, org_id, user_id, pages, subject, level, chunk_map)


# Singleton
graph_rag_service = GraphRagService()
