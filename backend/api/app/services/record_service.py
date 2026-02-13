"""Business logic for records (service layer)."""
from typing import Optional

from app.models.schemas import RecordCreate, RecordInDB, RecordUpdate
from app.repositories.record_repository import RecordRepository


class RecordService:
    """Orchestrates record operations."""

    def __init__(self) -> None:
        self._repo = RecordRepository()

    def create(self, payload: RecordCreate) -> RecordInDB:
        return self._repo.create(payload)

    def get(self, id: str) -> Optional[RecordInDB]:
        return self._repo.get_by_id(id)

    def list_all(self, limit: int = 100) -> list[RecordInDB]:
        return self._repo.list_all(limit=limit)

    def update(self, id: str, payload: RecordUpdate) -> Optional[RecordInDB]:
        return self._repo.update(id, payload)

    def delete(self, id: str) -> bool:
        return self._repo.delete(id)
