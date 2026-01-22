from datetime import datetime
from fastapi import HTTPException, status
from app.database.models import RegistrationCode, User, RegistrationRequest, RegistrationStatus


async def validate_registration_code(code: str, role_type: str) -> RegistrationCode:
    reg_code = await RegistrationCode.objects.get_or_none(
        code=code, role_type=role_type, used=False
    )
    
    if not reg_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired registration code"
        )
    
    if reg_code.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration code expired"
        )
    
    return reg_code


async def check_user_exists(email: str):
    existing_user = await User.objects.get_or_none(email=email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    existing_request = await RegistrationRequest.objects.get_or_none(email=email, status=RegistrationStatus.PENDING.value)
    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration request with this email is already pending"
        )


def registration_code_to_dict(code: RegistrationCode) -> dict:
    code_dict = code.model_dump(exclude={"creator", "used_by"})
    code_dict["creator_id"] = code.creator.id if hasattr(code, 'creator') and code.creator else None
    code_dict["used_by_id"] = code.used_by.id if hasattr(code, 'used_by') and code.used_by else None
    return code_dict
