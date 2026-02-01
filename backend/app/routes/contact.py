from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional
from schemas import ContactMessageCreate, ContactMessageResponse
from app.database.models.contact_message import ContactMessage
from app.database.models.user import User
from app.utils.auth import get_current_user_optional, get_current_admin

router = APIRouter(prefix="/contact", tags=["Contact"])


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    return request.client.host if request.client else "unknown"


@router.post("/send", response_model=ContactMessageResponse)
async def send_contact_message(
    data: ContactMessageCreate,
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    ip_address = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "")[:500]
    
    message = await ContactMessage.objects.create(
        message=data.message,
        user_id=current_user.id if current_user else None,
        username=current_user.username if current_user else None,
        email=current_user.email if current_user else None,
        ip_address=ip_address,
        user_agent=user_agent,
        is_read=False
    )
    
    return message


@router.get("/messages", response_model=List[ContactMessageResponse])
async def get_contact_messages(
    page: int = 1,
    per_page: int = 20,
    is_read: Optional[bool] = None,
    current_admin: User = Depends(get_current_admin)
):
    query = ContactMessage.objects
    
    if is_read is not None:
        query = query.filter(is_read=is_read)
    
    total = await query.count()
    offset = (page - 1) * per_page
    messages = await query.order_by("-created_at").offset(offset).limit(per_page).all()
    
    return messages


@router.get("/messages/count")
async def get_unread_count(
    current_admin: User = Depends(get_current_admin)
):
    unread = await ContactMessage.objects.filter(is_read=False).count()
    total = await ContactMessage.objects.count()
    
    return {"unread": unread, "total": total}


@router.patch("/messages/{message_id}/read")
async def mark_message_read(
    message_id: int,
    current_admin: User = Depends(get_current_admin)
):
    message = await ContactMessage.objects.get_or_none(id=message_id)
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    await message.update(is_read=True)
    return {"message": "Marked as read"}


@router.patch("/messages/read-all")
async def mark_all_read(
    current_admin: User = Depends(get_current_admin)
):
    await ContactMessage.objects.filter(is_read=False).update(is_read=True)
    return {"message": "All messages marked as read"}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_admin: User = Depends(get_current_admin)
):
    message = await ContactMessage.objects.get_or_none(id=message_id)
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    await message.delete()
    return {"message": "Message deleted"}
