from pydantic import BaseModel, Field


class AthleteProfileUpsertRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    sport: str = Field(min_length=1, max_length=60)
    grad_year: int | None = Field(default=None, ge=2026, le=2040)
    positions: list[str] = Field(default_factory=list, max_length=6)
    state: str | None = Field(default=None, max_length=40)
    country: str | None = Field(default="USA", max_length=60)
    willing_to_travel: bool = False
    travel_radius_mi: int | None = Field(default=None, ge=0, le=5000)
    club_team: str | None = Field(default=None, max_length=120)
    school_unitid: str | None = Field(default=None, min_length=2, max_length=16)
    high_school: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=800)
    avatar_media_asset_id: int | None = Field(default=None, ge=1)
    banner_media_asset_id: int | None = Field(default=None, ge=1)


class CoachProfileUpsertRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=150)
    organization_name: str | None = Field(default=None, max_length=255)
    school_unitid: str | None = Field(default=None, min_length=2, max_length=16)
    sport: str | None = Field(default=None, max_length=100)
    level: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=2000)
    avatar_media_asset_id: int | None = Field(default=None, ge=1)
    banner_media_asset_id: int | None = Field(default=None, ge=1)
