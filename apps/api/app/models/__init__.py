# Import every model so SQLAlchemy metadata has a complete picture of all tables
# and can resolve FK dependencies (e.g. groups.school_id → schools.id) before commit.
from app.models.user import User
from app.models.school import School
from app.models.organization import Organization
from app.models.permissions import Permission
from app.models.group import Group, GroupMember
from app.models.file import File
from app.models.chat import ChatMessage
from app.models.exam import Exam, Question, ExamSession
from app.models.flashcard import FlashcardSet, Flashcard, FlashcardProgress
from app.models.room import StudyRoom, RoomMember
from app.models.notification import Notification, Announcement, Subscription, ReadingEvent
from app.models.learning_path import LearningPath, LearningPathModule, LearningPathProgress
from app.models.slide_deck import SlideDeck, Slide, SlideProgress, SlideQuizAnswer
from app.models.audit_log import AuditLog
from app.models.feature_flag import FeatureFlag
from app.models.cohort import Cohort, CohortMember
from app.models.assignment import Assignment, AssignmentProgress
from app.models.goal import StudyGoal, StreakRecord, KpiCache
from app.models.gamification import UserXP, UserLevel, Badge, UserBadge, DailyChallenge
from app.models.live_quiz import LiveQuiz, LiveQuizParticipant, LiveQuizAnswer
from app.models.knowledge_graph import KnowledgeConcept, ConceptRelation
from app.models.failed_task import FailedTask
from app.models.bac import BacPaper, BacQuestion, BacPracticeSession

__all__ = [
    "User", "School",
    "Organization", "Permission",
    "Group", "GroupMember",
    "File",
    "ChatMessage",
    "Exam", "Question", "ExamSession",
    "FlashcardSet", "Flashcard", "FlashcardProgress",
    "StudyRoom", "RoomMember",
    "Notification", "Announcement", "Subscription", "ReadingEvent",
    "LearningPath", "LearningPathModule", "LearningPathProgress",
    "SlideDeck", "Slide", "SlideProgress", "SlideQuizAnswer",
    "AuditLog", "FeatureFlag",
    "Cohort", "CohortMember",
    "Assignment", "AssignmentProgress",
    "StudyGoal", "StreakRecord", "KpiCache",
    "UserXP", "UserLevel", "Badge", "UserBadge", "DailyChallenge",
    "LiveQuiz", "LiveQuizParticipant", "LiveQuizAnswer",
    "KnowledgeConcept", "ConceptRelation",
    "FailedTask",
    "BacPaper", "BacQuestion", "BacPracticeSession",
]
