from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CoachProfile(Base):
    __tablename__ = "coach_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)

    title: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)            # Assistant Coach, Head Coach
    organization_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # Columbia Men’s Soccer
    school_unitid: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    sport: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    level: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)             # NCAA D1 / Club / JUCO
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_verified_coach: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user = relationship("User", back_populates="coach_profile")
