"""Firestore repository for records (data layer)."""
from datetime import datetime
from typing import Optional

from app.models.schemas import RecordCreate, RecordInDB, RecordUpdate
from app.repositories.base import BaseRepository


class RecordRepository(BaseRepository[RecordInDB]):
    """CRUD for records in Firestore."""

    collection_name = "records"

    def _parse_dt(self, v):
        if v is None:
            return datetime.utcnow()
        if hasattr(v, "isoformat"):
            return v
        s = v if isinstance(v, str) else str(v)
        return datetime.fromisoformat(s.replace("Z", "+00:00"))

    def _to_model(self, data: dict) -> RecordInDB:
        return RecordInDB(
            id=data["id"],
            title=data["title"],
            description=data.get("description"),
            value=data.get("value"),
            created_at=self._parse_dt(data.get("created_at")),
            updated_at=self._parse_dt(data.get("updated_at")),
        )

    def _to_dict(self, model: RecordInDB) -> dict:
        return {
            "title": model.title,
            "description": model.description,
            "value": model.value,
            "created_at": model.created_at.isoformat(),
            "updated_at": model.updated_at.isoformat(),
        }

    def create(self, payload: RecordCreate) -> RecordInDB:
        now = datetime.utcnow()
        data = {
            "title": payload.title,
            "description": payload.description,
            "value": payload.value,
            "created_at": now.isoformat() + "Z",
            "updated_at": now.isoformat() + "Z",
        }
        ref = self._coll.add(data)
        doc_id = ref.id
        return self.get_by_id(doc_id)

    def get_by_id(self, id: str) -> Optional[RecordInDB]:
        doc = self._coll.document(id).get()
        if not doc.exists:
            return None
        return self._to_model(self._doc_to_dict(doc))

    def list_all(self, limit: int = 100) -> list[RecordInDB]:
        docs = self._coll.order_by("created_at", direction="DESCENDING").limit(limit).stream()
        return [self._to_model(self._doc_to_dict(d)) for d in docs]

    def update(self, id: str, payload: RecordUpdate) -> Optional[RecordInDB]:
        ref = self._coll.document(id)
        doc = ref.get()
        if not doc.exists:
            return None
        data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
        if not data:
            return self._to_model(self._doc_to_dict(doc))
        data["updated_at"] = datetime.utcnow().isoformat() + "Z"
        ref.update(data)
        return self.get_by_id(id)

    def delete(self, id: str) -> bool:
        ref = self._coll.document(id)
        doc = ref.get()
        if not doc.exists:
            return False
        ref.delete()
        return True
