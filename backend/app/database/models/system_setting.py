from ormar import Model, String
from app.database.database import base_ormar_config


class SystemSetting(Model):
    ormar_config = base_ormar_config.copy(tablename="system_settings")

    key: str = String(max_length=100, primary_key=True)
    value: str = String(max_length=500)
