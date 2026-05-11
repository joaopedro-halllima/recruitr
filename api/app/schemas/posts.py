from pydantic import BaseModel, Field


class CreatePostRequest(BaseModel):
    caption: str = Field(default="", max_length=3000)
    sport: str = Field(min_length=1, max_length=60)
    media_asset_ids: list[int] = Field(min_length=1, max_length=4)
    tags: list[str] = Field(default_factory=list, max_length=12)
