"""Base repository for Firebase Firestore (data layer)."""
from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from app.core.firebase import get_firestore

T = TypeVar("T")


class BaseRepository(ABC, Generic[T]):
    """Abstract base for Firestore collections."""

    collection_name: str = ""

    def __init__(self) -> None:
        self._db = get_firestore()
        self._coll = self._db.collection(self.collection_name)

    def _doc_to_dict(self, doc) -> dict:
        """Convert Firestore document snapshot to dict with id."""
        data = doc.to_dict()
        data["id"] = doc.id
        return data

    @abstractmethod
    def _to_model(self, data: dict) -> T:
        """Map Firestore dict to domain model."""
        pass

    @abstractmethod
    def _to_dict(self, model: T) -> dict:
        """Map domain model to Firestore-serializable dict."""
        pass
