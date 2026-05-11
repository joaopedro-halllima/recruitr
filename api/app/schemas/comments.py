from __future__ import annotations

from pydantic import BaseModel, Field


class CommentMentionCreateRequest(BaseModel):
    user_id: int = Field(ge=1)
    handle: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=120)


class CommentCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    parent_comment_id: int | None = Field(default=None, ge=1)
    mentions: list[CommentMentionCreateRequest] = Field(default_factory=list, max_length=12)
