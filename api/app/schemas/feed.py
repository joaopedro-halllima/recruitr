from typing import Literal

from pydantic import BaseModel, Field


class FeedEventCreateRequest(BaseModel):
    post_id: int = Field(ge=1)
    event_type: Literal["view_3s", "like", "save", "profile_open", "hide", "report"]
    algorithm_version: str | None = "post_feed_v2"
    metadata: dict | None = None
