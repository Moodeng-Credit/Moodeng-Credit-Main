"""Pydantic schemas for API and validation."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RecordBase(BaseModel):
    """Shared fields for create/update."""

    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    value: Optional[float] = None


class RecordCreate(RecordBase):
    """Payload for creating a record."""

    pass


class RecordUpdate(BaseModel):
    """Payload for partial update."""

    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    value: Optional[float] = None


class RecordInDB(RecordBase):
    """Record as stored (with id and timestamps)."""

    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecordResponse(RecordInDB):
    """Record as returned by the API."""

    pass
