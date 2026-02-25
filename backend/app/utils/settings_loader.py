import json
from typing import Optional, Dict, Any

from app.database.models.system_setting import SystemSetting


_SettingsKeys = frozenset({
    "auto_registration_enabled",
    "registration_enabled",
    "maintenance_mode",
    "contact_enabled",
    "home_banner_text",
    "home_banner_style",
})


def _bool_val(s: Optional["SystemSetting"]) -> bool:
    return s is not None and s.value and s.value.lower() == "true"


def _str_val(s: Optional["SystemSetting"], default: Optional[str] = None) -> Optional[str]:
    return (s.value if s and s.value else None) or default


def _json_val(s: Optional["SystemSetting"], default=None):
    if not s or not s.value:
        return default
    try:
        return json.loads(s.value)
    except (json.JSONDecodeError, TypeError):
        return default


async def load_settings_batch(keys: Optional[frozenset] = None) -> Dict[str, "SystemSetting"]:
    keys = keys or _SettingsKeys
    rows = await SystemSetting.objects.filter(key__in=list(keys)).all()
    return {r.key: r for r in rows}


def _bool_from_row(row: Optional["SystemSetting"], default: bool) -> bool:
    return _bool_val(row) if row else default


async def get_admin_settings_dict() -> Dict[str, Any]:
    rows = await load_settings_batch()
    return {
        "auto_registration_enabled": _bool_from_row(rows.get("auto_registration_enabled"), False),
        "registration_enabled": _bool_from_row(rows.get("registration_enabled"), True),
        "maintenance_mode": _bool_from_row(rows.get("maintenance_mode"), False),
        "contact_enabled": _bool_from_row(rows.get("contact_enabled"), True),
        "home_banner_text": _json_val(rows.get("home_banner_text")) or None,
        "home_banner_style": _str_val(rows.get("home_banner_style")) or None,
    }


async def get_registration_settings_dict() -> Dict[str, Any]:
    rows = await load_settings_batch()
    return {
        "auto_registration_enabled": _bool_from_row(rows.get("auto_registration_enabled"), False),
        "registration_enabled": _bool_from_row(rows.get("registration_enabled"), True),
        "maintenance_mode": _bool_from_row(rows.get("maintenance_mode"), False),
        "contact_enabled": _bool_from_row(rows.get("contact_enabled"), True),
        "home_banner_text": _json_val(rows.get("home_banner_text"), {}) or {},
        "home_banner_style": _str_val(rows.get("home_banner_style"), "warning") or "warning",
    }


async def get_single_bool(key: str, default: bool = False) -> bool:
    s = await SystemSetting.objects.get_or_none(key=key)
    return _bool_val(s) if s else default


async def get_single_str(key: str, default: Optional[str] = None) -> Optional[str]:
    s = await SystemSetting.objects.get_or_none(key=key)
    return _str_val(s, default)


async def set_setting(key: str, value: str):
    s = await SystemSetting.objects.get_or_none(key=key)
    if s:
        await s.update(value=value)
    else:
        await SystemSetting.objects.create(key=key, value=value)


async def set_bool(key: str, value: bool):
    await set_setting(key, "true" if value else "false")


async def set_str_setting(key: str, value: Optional[str]):
    await set_setting(key, (value or "").strip() or "")


async def set_json_setting(key: str, value: Any):
    await set_setting(key, json.dumps(value, ensure_ascii=False) if value else "")
