from pydantic import BaseModel, Field


class CreateShortlistRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class AddShortlistItemRequest(BaseModel):
    athlete_user_id: int = Field(ge=1)
    note: str | None = Field(default=None, max_length=1000)


class UpdateShortlistItemNoteRequest(BaseModel):
    note: str | None = Field(default=None, max_length=1000)
