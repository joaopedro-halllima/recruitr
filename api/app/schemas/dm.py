from pydantic import BaseModel, Field
from typing import Literal


class CreateThreadRequest(BaseModel):
    athlete_user_id: int = Field(ge=1)
    initial_message: str = Field(min_length=1, max_length=4000)
    media_asset_ids: list[int] = Field(default_factory=list, max_length=5)


class SendMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    media_asset_ids: list[int] = Field(default_factory=list, max_length=5)


class CreateDmMediaAssetRequest(BaseModel):
    kind: Literal["image", "video", "document"]
    public_url: str = Field(min_length=1, max_length=1024)
    thumb_public_url: str | None = Field(default=None, max_length=1024)
    mime_type: str | None = Field(default=None, max_length=120)
    byte_size: int | None = Field(default=None, ge=0)
