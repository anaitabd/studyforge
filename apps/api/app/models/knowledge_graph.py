"""
Knowledge graph for concept-based retrieval.
Nodes = concepts (theorems, definitions, techniques).
Edges = relationships (requires, applies, extends, contradicts).
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, Float, func, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class KnowledgeConcept(Base):
    __tablename__ = "knowledge_concepts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    file_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(200))       # e.g. "Probabilité conditionnelle"
    subject: Mapped[str] = mapped_column(String(50))     # e.g. "math"
    level: Mapped[str | None] = mapped_column(String(20))  # e.g. "2BAC"
    definition: Mapped[str] = mapped_column(Text)        # short definition
    formula: Mapped[str | None] = mapped_column(Text)    # LaTeX if applicable: P(A|B) = P(A∩B)/P(B)
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
    weight: Mapped[float] = mapped_column(Float, default=1.0)
