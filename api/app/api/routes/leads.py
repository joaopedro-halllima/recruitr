from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.models.lead import Lead

router = APIRouter(prefix="/api/v1/leads", tags=["leads"])


class LeadCaptureRequest(BaseModel):
    email: EmailStr
    source: str | None = "landing"


class LeadCaptureResponse(BaseModel):
    ok: bool
    lead_id: int


@router.post("", response_model=LeadCaptureResponse, status_code=201)
def capture_lead(payload: LeadCaptureRequest, db: Session = Depends(get_db)):
    email = str(payload.email).lower().strip()

    existing = db.execute(select(Lead).where(Lead.email == email)).scalar_one_or_none()
    if existing:
        # Already captured (don’t error; just return OK)
        return {"ok": True, "lead_id": existing.id}

    lead = Lead(email=email, source=payload.source)
    db.add(lead)
    db.commit()
    db.refresh(lead)

    return {"ok": True, "lead_id": lead.id}
