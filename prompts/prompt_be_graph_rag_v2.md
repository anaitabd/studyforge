# StudyForge — Graph RAG Implementation

## Why Graph RAG

Standard RAG retrieves chunks by similarity. For a math exam like this:

  "Exercice 2 — Un sac contient cinq boules blanches numérotées 1-2-3-3-3..."

Similarity search finds chunks about probability. But it cannot answer:
- "Why is my P(A∩B) calculation wrong?" — needs to know which theorem was violated
- "What do I need to study before independence?" — needs concept prerequisites
- "Show me all exercises that use conditional probability" — needs concept-to-exercise links

Graph RAG adds a knowledge graph on top of the vector store. Every document
populates both. Queries traverse the graph first, then fetch vector chunks.

---

## Step 0 — Read before writing

```bash
cat apps/api/app/services/rag_service.py
cat apps/api/app/services/ai_service.py
cat apps/api/app/services/vector_store.py
cat apps/api/app/services/file_processor.py
cat apps/api/app/services/curriculum_service.py
cat apps/api/requirements.txt
```

---

## Step 1 — Install dependencies

Add to `apps/api/requirements.txt`:
```
networkx==3.3
```

No other new packages. We store the graph as JSONB in PostgreSQL — no new infra.

---

## Step 2 — Knowledge graph model

Create `apps/api/app/models/knowledge_graph.py`:

```python
"""
Knowledge graph for concept-based retrieval.
Nodes = concepts (theorems, definitions, techniques).
Edges = relationships (requires, applies, extends, contradicts).
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class KnowledgeConcept(Base):
    __tablename__ = "knowledge_concepts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    file_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(200))          # e.g. "Probabilité conditionnelle"
    subject: Mapped[str] = mapped_column(String(50))         # e.g. "math"
    level: Mapped[str | None] = mapped_column(String(20))    # e.g. "2BAC"
    definition: Mapped[str] = mapped_column(Text)            # short definition
    formula: Mapped[str | None] = mapped_column(Text)        # LaTeX if applicable: P(A|B) = P(A∩B)/P(B)
    chunk_ids: Mapped[list] = mapped_column(JSONB, default=[])  # ChromaDB chunk IDs containing this concept
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ConceptRelation(Base):
    __tablename__ = "concept_relations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_id: Mapped[str] = mapped_column(String(36), ForeignKey("knowledge_concepts.id", ondelete="CASCADE"))
    target_id: Mapped[str] = mapped_column(String(36), ForeignKey("knowledge_concepts.id", ondelete="CASCADE"))
    relation_type: Mapped[str] = mapped_column(String(50))
    # relation types:
    # "requires"    — source requires target as prerequisite
    # "applies"     — source applies target theorem/formula
    # "extends"     — source is a generalization of target
    # "contradicts" — common misconception: students confuse source with target
    weight: Mapped[float] = mapped_column(default=1.0)       # relevance weight
```

Create Alembic migration for these two tables. Run it with Docker postgres up.

---

## Step 3 — Graph RAG service

Create `apps/api/app/services/graph_rag_service.py`:

```python
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
        batch = text_pages[i:i+3]
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
                # Track which chunk IDs contain this concept
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
    # Find all concepts for this user/org
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


# Singleton
graph_rag_service = GraphRagService()

class GraphRagService:
    async def augment_query(self, db, query, org_id, user_id, subject=None):
        return await get_concept_context(db, query, org_id, user_id, subject)

    async def build_for_file(self, db, file_id, org_id, user_id, pages, subject, level, chunk_map):
        return await build_graph_for_file(db, file_id, org_id, user_id, pages, subject, level, chunk_map)

graph_rag_service = GraphRagService()
```

---

## Step 4 — Wire graph extraction into file processing

Open `apps/api/app/jobs/file_jobs.py`. After the file is chunked and embedded
into ChromaDB (after the existing `vector_store.upsert_chunks()` call), add:

```python
from app.services.graph_rag_service import graph_rag_service
from app.services.curriculum_service import detect_subject, detect_level

# After ChromaDB upsert:
combined_sample = " ".join(p["text"] for p in pages[:5])
subject = detect_subject(combined_sample)
level = detect_level(combined_sample)

# Build chunk_id_map: page_number → chunk_id
# (chunks already have metadata with page_number and chunk_index)
chunk_id_map = {
    chunk["metadata"]["page_number"]: chunk["id"]
    for chunk in chunks
    if chunk.get("metadata", {}).get("page_number")
}

concept_count = await graph_rag_service.build_for_file(
    db=db,
    file_id=file_id,
    org_id=org_id,
    user_id=user_id,
    pages=pages,
    subject=subject,
    level=level,
    chunk_id_map=chunk_id_map,
)
logger.info(f"Extracted {concept_count} concepts from file {file_id}")
```

---

## Step 5 — Wire graph context into RAG query

Open `apps/api/app/services/rag_service.py`. In the `query()` method,
between Step 1 (rewrite query) and Step 3 (ChromaDB search), add:

```python
# 1.5 — Graph context augmentation
from app.services.graph_rag_service import graph_rag_service

graph_context = await graph_rag_service.augment_query(
    db=db,   # need to pass db into query() — see below
    query=rewritten,
    org_id=org_id,
    user_id=user_id,
)

# Priority-boost graph-linked chunk IDs in ChromaDB query:
# If graph found relevant chunk IDs, query those first before doing similarity search
priority_chunk_ids = graph_context.get("chunk_ids", [])
```

Extend the ChromaDB query call to prefer graph-identified chunks:
```python
# If graph found specific chunks, retrieve those first
graph_chunks = []
if priority_chunk_ids:
    graph_chunks = vector_store.get_chunks_by_ids(priority_chunk_ids[:5])

# Then do normal similarity search
raw_chunks = vector_store.query(
    org_id=org_id,
    user_id=user_id,
    query_embedding=query_embedding,
    top_k=8,
    min_score=0.4,
)

# Merge: graph chunks first (deduplicated), then similarity chunks
seen_ids = {c["id"] for c in graph_chunks}
merged_chunks = graph_chunks + [c for c in raw_chunks if c["id"] not in seen_ids]
top_chunks = reranker.rerank(rewritten, merged_chunks[:12], top_k=5)
```

Inject concept context into the system prompt:
```python
# Build concept context block for the system prompt
concept_block = ""
if graph_context.get("matched_concepts"):
    lines = ["RELEVANT CONCEPTS FROM YOUR COURSE MATERIAL:"]
    for c in graph_context["matched_concepts"]:
        line = f"• {c['name']}: {c['definition']}"
        if c.get("formula"):
            line += f" (Formula: {c['formula']})"
        lines.append(line)
    if graph_context.get("prerequisite_concepts"):
        lines.append("\nPREREQUISITE CONCEPTS (needed to understand the above):")
        for c in graph_context["prerequisite_concepts"]:
            lines.append(f"• {c['name']}: {c['definition']}")
    concept_block = "\n".join(lines)
```

Pass `concept_block` to `_build_system_prompt()` and inject it after the
rules, before the course material context:
```python
messages = [
    {"role": "system", "content": rules_prompt},
    {"role": "user", "content": f"COURSE MATERIAL FOR THIS SESSION:\n\n{context}"},
    {"role": "assistant", "content": "Understood. I will answer based on this material."},
]
if concept_block:
    messages.insert(2, {"role": "user", "content": concept_block})
    messages.insert(3, {"role": "assistant", "content": "I see the relevant concepts. I'll use these to structure my answer."})
```

Also add `get_chunks_by_ids` to `vector_store.py`:
```python
def get_chunks_by_ids(self, chunk_ids: list[str]) -> list[dict]:
    """Retrieve specific chunks by their ChromaDB IDs."""
    collection = self._get_collection(...)
    results = collection.get(ids=chunk_ids, include=["documents", "metadatas"])
    return [
        {"id": ids, "text": doc, "metadata": meta}
        for ids, doc, meta in zip(
            results["ids"], results["documents"], results["metadatas"]
        )
    ]
```

The `query()` method also needs `db: AsyncSession` as a new parameter.
Update all callers (the chat route handler) accordingly.

---

## Step 6 — Concept API endpoints

Add to `apps/api/app/api/v1/chat.py` (or create a new `concepts.py`):

```
GET /groups/{group_id}/concepts
  — list all concepts extracted from this group's files
  — response: [{id, name, subject, level, definition, formula, chunk_ids}]

GET /groups/{group_id}/concepts/{concept_id}/prerequisites
  — prerequisite chain for one concept (BFS up to depth=3)
  — response: {concept, prerequisites: [{name, definition}]}

GET /groups/{group_id}/concepts/map
  — full concept graph for a group as nodes+edges (for visualization)
  — response: {nodes: [{id, name, level}], edges: [{source, target, type}]}
```

---

## Step 7 — Verification

```bash
python -c "
from app.services.graph_rag_service import graph_rag_service
from app.models.knowledge_graph import KnowledgeConcept, ConceptRelation
print('Graph RAG: OK')
"

# Confirm tables exist after migration
python -c "
import asyncio
from app.core.database import async_session
from sqlalchemy import text
async def check():
    async with async_session() as db:
        r = await db.execute(text('SELECT count(*) FROM knowledge_concepts'))
        print('knowledge_concepts:', r.scalar())
asyncio.run(check())
"
```
