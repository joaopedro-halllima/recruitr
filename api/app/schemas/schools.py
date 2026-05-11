from typing import Literal

from pydantic import BaseModel, Field


class CreateTeamRequest(BaseModel):
    sport: str = Field(min_length=1, max_length=80)
    team_name: str = Field(min_length=2, max_length=180)


class JoinTeamRequest(BaseModel):
    role: Literal["athlete", "coach", "staff"]
