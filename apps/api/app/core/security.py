import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from app.core.config import settings
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

# Simple in-process JWKS cache — refreshed on key-id miss
_jwks_cache: dict = {}


async def _get_jwks(issuer: str) -> dict:
    if issuer in _jwks_cache:
        return _jwks_cache[issuer]
    url = f"{issuer}/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
        resp.raise_for_status()
    _jwks_cache[issuer] = resp.json()
    return _jwks_cache[issuer]


async def _verify_clerk_jwt(token: str) -> dict:
    """Verify a Clerk session JWT using JWKS and return its claims."""
    try:
        unverified_claims = jwt.get_unverified_claims(token)
        issuer = unverified_claims.get("iss", "")
        if not issuer:
            raise JWTError("Missing issuer")

        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        jwks = await _get_jwks(issuer)
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)

        # Refresh cache once on key-id miss (key rotation)
        if key is None:
            _jwks_cache.pop(issuer, None)
            jwks = await _get_jwks(issuer)
            key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)

        if key is None:
            raise JWTError("No matching public key")

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        )


async def _get_or_create_user(clerk_id: str, db: AsyncSession):
    """Return the local User record, creating it from Clerk API if missing."""
    from app.models.user import User
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()
    if user:
        return user

    # Auto-provision: fetch details from Clerk Management API
    email = f"{clerk_id}@unknown.local"
    name = clerk_id
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.clerk.com/v1/users/{clerk_id}",
                headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
                timeout=10,
            )
        if resp.status_code == 200:
            data = resp.json()
            primary_email = next(
                (e["email_address"] for e in data.get("email_addresses", [])
                 if e["id"] == data.get("primary_email_address_id")),
                None,
            )
            if primary_email:
                email = primary_email
            first = data.get("first_name") or ""
            last = data.get("last_name") or ""
            name = f"{first} {last}".strip() or clerk_id
    except Exception as exc:
        logger.warning(f"Could not fetch Clerk user {clerk_id}: {exc}")

    user = User(clerk_id=clerk_id, email=email, name=name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(f"Auto-provisioned user {clerk_id} ({email})")
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = await _verify_clerk_jwt(credentials.credentials)
    clerk_id = payload.get("sub")
    if not clerk_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return await _get_or_create_user(clerk_id, db)


def require_role(*roles: str):
    async def dependency(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return Depends(dependency)
