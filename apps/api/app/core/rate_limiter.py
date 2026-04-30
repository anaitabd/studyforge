import logging
from datetime import date

logger = logging.getLogger(__name__)

PLAN_LIMITS = {
    "free": {
        "chat_per_day": 20,
        "qcm_per_month": 5,
        "groups": 1,
        "files_per_group": 5,
    },
    "personal": {
        "chat_per_day": 500,
        "qcm_per_month": 999999,
        "groups": 999999,
        "files_per_group": 50,
    },
    "school": {
        "chat_per_day": 999999,
        "qcm_per_month": 999999,
        "groups": 999999,
        "files_per_group": 999999,
    },
}

PLAN_FEATURES = {
    "free": {
        "collaborative_rooms": False,
        "flashcards": False,
        "pptx_generation": False,
        "teacher_dashboard": False,
        "whatsapp_notifications": False,
        "reading_analytics": False,
    },
    "personal": {
        "collaborative_rooms": True,
        "flashcards": True,
        "pptx_generation": True,
        "teacher_dashboard": False,
        "whatsapp_notifications": False,
        "reading_analytics": False,
    },
    "school": {
        "collaborative_rooms": True,
        "flashcards": True,
        "pptx_generation": True,
        "teacher_dashboard": True,
        "whatsapp_notifications": True,
        "reading_analytics": True,
    },
}


class RateLimiter:
    def __init__(self, redis_client=None):
        self.redis = redis_client

    async def check_and_increment(
        self, user_id: str, plan: str, limit_key: str, window: str = "day"
    ) -> tuple[bool, int, int]:
        """
        Returns (allowed: bool, current: int, limit: int).
        window: 'day' or 'month'
        """
        plan_limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
        limit = plan_limits.get(limit_key, 0)

        if limit >= 999999:
            return True, 0, limit

        today = date.today()
        window_id = (
            today.isoformat()
            if window == "day"
            else f"{today.year}-{today.month:02d}"
        )
        key = f"usage:{limit_key}:{user_id}:{window_id}"
        ttl = 86400 if window == "day" else 2592000

        if self.redis:
            try:
                current = await self.redis.incr(key)
                if current == 1:
                    await self.redis.expire(key, ttl)
                return current <= limit, current, limit
            except Exception as e:
                logger.warning(f"Redis rate limit error: {e}, allowing request")
                return True, 0, limit

        return True, 0, limit

    def check_feature(self, plan: str, feature: str) -> bool:
        """Check if a feature is available on the given plan."""
        return PLAN_FEATURES.get(plan, PLAN_FEATURES["free"]).get(feature, False)


# Singleton (redis will be injected when available)
rate_limiter = RateLimiter()
