"""Record HTTP endpoints (API layer)."""
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import RecordCreate, RecordResponse, RecordUpdate
from app.services.record_service import RecordService

router = APIRouter(prefix="/records", tags=["records"])
service = RecordService()


@router.post("", response_model=RecordResponse, status_code=status.HTTP_201_CREATED)
def create_record(payload: RecordCreate) -> RecordResponse:
    """Create a new record in Firebase."""
    record = service.create(payload)
    return RecordResponse.model_validate(record)


@router.get("", response_model=list[RecordResponse])
def list_records(limit: int = 100) -> list[RecordResponse]:
    """List records from Firebase."""
    records = service.list_all(limit=limit)
    return [RecordResponse.model_validate(r) for r in records]


@router.get("/{id}", response_model=RecordResponse)
def get_record(id: str) -> RecordResponse:
    """Get a record by id."""
    record = service.get(id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return RecordResponse.model_validate(record)


@router.patch("/{id}", response_model=RecordResponse)
def update_record(id: str, payload: RecordUpdate) -> RecordResponse:
    """Update a record."""
    record = service.update(id, payload)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return RecordResponse.model_validate(record)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(id: str) -> None:
    """Delete a record."""
    if not service.delete(id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
