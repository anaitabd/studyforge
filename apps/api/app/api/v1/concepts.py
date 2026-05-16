import logging
from typing import Annotated

import networkx as nx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.file import File
from app.models.group import GroupMember
from app.models.knowledge_graph import ConceptRelation, KnowledgeConcept

logger = logging.getLogger(__name__)
router = APIRouter(tags=["concepts"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


async def _require_group_member(group_id: str, user_id: str, db: AsyncSession) -> GroupMember:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return m


async def _get_group_file_ids(group_id: str, db: AsyncSession) -> list[str]:
    result = await db.execute(select(File.id).where(File.group_id == group_id))
    return [row[0] for row in result.all()]


async def _get_group_concepts(group_id: str, db: AsyncSession) -> list[KnowledgeConcept]:
    file_ids = await _get_group_file_ids(group_id, db)
    if not file_ids:
        return []
    result = await db.execute(
        select(KnowledgeConcept).where(KnowledgeConcept.file_id.in_(file_ids))
    )
    return result.scalars().all()


@router.get("/groups/{group_id}/concepts")
async def list_concepts(group_id: str, current_user: CurrentUser, db: DB):
    """List all concepts extracted from this group's files."""
    await _require_group_member(group_id, current_user.id, db)
    concepts = await _get_group_concepts(group_id, db)
    return {
        "concepts": [
            {
                "id": c.id,
                "name": c.name,
                "subject": c.subject,
                "level": c.level,
                "definition": c.definition,
                "formula": c.formula,
                "chunk_ids": c.chunk_ids,
                "created_at": c.created_at.isoformat(),
            }
            for c in concepts
        ],
        "total": len(concepts),
    }


@router.get("/groups/{group_id}/concepts/{concept_id}/prerequisites")
async def get_prerequisites(
    group_id: str,
    concept_id: str,
    current_user: CurrentUser,
    db: DB,
    depth: int = 3,
):
    """Prerequisite chain for one concept — BFS up to depth hops."""
    await _require_group_member(group_id, current_user.id, db)

    concept = await db.get(KnowledgeConcept, concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    # Load all concepts for this group to build the subgraph
    all_concepts = await _get_group_concepts(group_id, db)
    concept_ids = [c.id for c in all_concepts]

    if not concept_ids:
        return {"concept": concept.name, "prerequisites": []}

    relations_result = await db.execute(
        select(ConceptRelation).where(ConceptRelation.source_id.in_(concept_ids))
    )
    relations = relations_result.scalars().all()

    G = nx.DiGraph()
    id_to_concept = {c.id: c for c in all_concepts}
    for c in all_concepts:
        G.add_node(c.id)
    for r in relations:
        G.add_edge(r.source_id, r.target_id, type=r.relation_type)

    prereq_ids = []
    if concept_id in G:
        prereq_ids = [
            node for node in nx.bfs_tree(G, concept_id, depth_limit=depth).nodes()
            if node != concept_id
        ]

    return {
        "concept": {"id": concept.id, "name": concept.name, "definition": concept.definition},
        "prerequisites": [
            {"name": id_to_concept[pid].name, "definition": id_to_concept[pid].definition}
            for pid in prereq_ids
            if pid in id_to_concept
        ],
    }


@router.get("/groups/{group_id}/concepts/map")
async def concept_map(group_id: str, current_user: CurrentUser, db: DB):
    """Full concept graph for a group as nodes+edges — for frontend visualization."""
    await _require_group_member(group_id, current_user.id, db)

    concepts = await _get_group_concepts(group_id, db)
    if not concepts:
        return {"nodes": [], "edges": []}

    concept_ids = [c.id for c in concepts]
    relations_result = await db.execute(
        select(ConceptRelation).where(
            ConceptRelation.source_id.in_(concept_ids),
            ConceptRelation.target_id.in_(concept_ids),
        )
    )
    relations = relations_result.scalars().all()

    return {
        "nodes": [
            {"id": c.id, "name": c.name, "subject": c.subject, "level": c.level}
            for c in concepts
        ],
        "edges": [
            {"source": r.source_id, "target": r.target_id, "type": r.relation_type}
            for r in relations
        ],
    }
