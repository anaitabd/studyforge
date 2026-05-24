import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

BAC_BRANCHES = ["SM", "SE", "SEco", "SH", "SAgro", "SA", "Lettres", "Arts"]
BAC_SESSIONS = ["normale", "rattrapage"]
BAC_REGIONS = ["nationale", "regionale"]

# Subject pool per branch (used for validation and filter UI)
BAC_SUBJECTS_BY_BRANCH: dict[str, list[str]] = {
    "SM":     ["Mathématiques", "Physique-Chimie", "Informatique", "Langue Arabe",
               "Langue Française", "Philosophie", "Éducation Islamique", "Histoire-Géographie"],
    "SE":     ["Mathématiques", "Physique-Chimie", "SVT", "Langue Arabe",
               "Langue Française", "Philosophie", "Éducation Islamique", "Histoire-Géographie"],
    "SEco":   ["Mathématiques", "Économie-Gestion", "Comptabilité-Finance", "Droit",
               "Langue Arabe", "Langue Française", "Philosophie", "Histoire-Géographie"],
    "SH":     ["Histoire-Géographie", "Philosophie", "Sociologie", "Langue Arabe",
               "Langue Française", "Mathématiques"],
    "SAgro":  ["Sciences Agro-Alimentaires", "Mathématiques", "Physique-Chimie", "SVT",
               "Langue Arabe", "Langue Française"],
    "SA":     ["Sciences Agronomiques", "Mathématiques", "Physique-Chimie", "SVT",
               "Langue Arabe", "Langue Française"],
    "Lettres": ["Langue et Littérature Arabes", "Langue et Littérature Françaises",
                "Langue Anglaise", "Philosophie", "Histoire-Géographie", "Éducation Islamique"],
    "Arts":   ["Arts Plastiques", "Langue Arabe", "Langue Française", "Philosophie",
               "Histoire-Géographie"],
}


class BacPaper(Base):
    __tablename__ = "bac_papers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    year: Mapped[int] = mapped_column(Integer, index=True)
    branch: Mapped[str] = mapped_column(String(20), index=True)   # SM, SE, SEco …
    subject: Mapped[str] = mapped_column(String(100), index=True)
    region: Mapped[str] = mapped_column(String(20), default="nationale")   # nationale / regionale
    session: Mapped[str] = mapped_column(String(20), default="normale")    # normale / rattrapage
    title: Mapped[str] = mapped_column(String(255))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=120)
    total_points: Mapped[float] = mapped_column(Float, default=20.0)
    # Ref to files.id — no FK constraint because file may have no group_id
    file_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    extraction_status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending / extracting / ready / error
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BacQuestion(Base):
    __tablename__ = "bac_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id: Mapped[str] = mapped_column(String(36), ForeignKey("bac_papers.id", ondelete="CASCADE"), index=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    part_label: Mapped[str | None] = mapped_column(String(100), nullable=True)  # "Exercice 1"
    type: Mapped[str] = mapped_column(String(30), default="open_calculation")
    # mcq_single / open_calculation / essay / document_analysis / fill_blank
    content: Mapped[str] = mapped_column(Text)
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)   # {A: "...", B: "..."}
    correct_answer: Mapped[str] = mapped_column(Text, default="")
    explanation_fr: Mapped[str] = mapped_column(Text, default="")
    explanation_ar: Mapped[str] = mapped_column(Text, default="")
    # rubric: [{criteria, max_points, description_fr, description_ar}]
    rubric: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    points: Mapped[float] = mapped_column(Float, default=1.0)
    subject_area: Mapped[str | None] = mapped_column(String(100), nullable=True)


class BacPracticeSession(Base):
    __tablename__ = "bac_practice_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    paper_id: Mapped[str] = mapped_column(String(36), ForeignKey("bac_papers.id"), index=True)
    answers: Mapped[dict] = mapped_column(JSONB, default={})
    # {question_id: {score, max_points, feedback_fr, feedback_ar, correct_answer, criteria_scores}}
    per_question_scores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    score_over_20: Mapped[float | None] = mapped_column(Float, nullable=True)
    grading_status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending / grading / graded / error
    duration_minutes: Mapped[int] = mapped_column(Integer, default=120)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    time_spent_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
