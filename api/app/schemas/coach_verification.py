from pydantic import BaseModel, Field


class CoachVerificationRequestCreate(BaseModel):
    notes: str | None = Field(default=None, max_length=2000)
    evidence_media_asset_id: int | None = Field(default=None, ge=1)


class CoachVerificationReviewRequest(BaseModel):
    notes: str | None = Field(default=None, max_length=2000)
