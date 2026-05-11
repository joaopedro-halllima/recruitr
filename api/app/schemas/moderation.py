from pydantic import BaseModel, Field, model_validator


class ReportCreateRequest(BaseModel):
    target_user_id: int | None = Field(default=None, ge=1)
    target_post_id: int | None = Field(default=None, ge=1)
    reason: str = Field(default="other", min_length=1, max_length=64)
    details: str | None = Field(default=None, max_length=3000)

    @model_validator(mode="after")
    def validate_target(self):
        if self.target_user_id is None and self.target_post_id is None:
            raise ValueError("target_user_id or target_post_id is required")
        return self
