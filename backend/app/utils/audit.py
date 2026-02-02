from typing import Optional, Any
from fastapi import Request
import json

from app.database.models.audit_log import AuditLog


def _get_ip(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _get_user_agent(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    ua = request.headers.get("User-Agent")
    return (ua[:500] if ua else None) or None


async def log_audit(
    action: str,
    *,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[Any] = None,
    request: Optional[Request] = None,
) -> None:
    details_str = None
    if details is not None:
        details_str = json.dumps(details, ensure_ascii=False) if isinstance(details, dict) else str(details)
    await AuditLog.objects.create(
        user_id=user_id,
        username=username,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        details=details_str,
        ip_address=_get_ip(request),
        user_agent=_get_user_agent(request),
    )
