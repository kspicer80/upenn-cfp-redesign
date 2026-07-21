"""
models.py — Pydantic schemas for request validation and API responses.
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


VALID_TYPES = {"Conference", "Journal", "Announcement"}
VALID_STATUSES = {"pending", "approved", "rejected", "archived"}
MAX_CATEGORIES = 5


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str


# ─────────────────────────────────────────────────────────────────────────────
#  CFP submission (inbound)
# ─────────────────────────────────────────────────────────────────────────────

class CFPSubmit(BaseModel):
    title: str
    organization: str
    contact_email: EmailStr
    deadline: date
    listing_type: str = "Conference"
    content: str
    category_ids: list[int]

    @field_validator("title", "organization", "content")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field must not be blank")
        return v.strip()

    @field_validator("listing_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in VALID_TYPES:
            raise ValueError(f"listing_type must be one of: {VALID_TYPES}")
        return v

    @field_validator("deadline")
    @classmethod
    def deadline_future(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("Deadline must be in the future")
        return v

    @field_validator("category_ids")
    @classmethod
    def valid_categories(cls, v: list[int]) -> list[int]:
        if not v:
            raise ValueError("At least one category is required")
        if len(v) > MAX_CATEGORIES:
            raise ValueError(f"Maximum {MAX_CATEGORIES} categories allowed")
        return v


# ─────────────────────────────────────────────────────────────────────────────
#  CFP edit (inbound — requires token)
# ─────────────────────────────────────────────────────────────────────────────

class CFPEdit(BaseModel):
    edit_token: str
    title: Optional[str] = None
    organization: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    listing_type: Optional[str] = None
    content: Optional[str] = None
    category_ids: Optional[list[int]] = None

    @field_validator("listing_type")
    @classmethod
    def valid_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_TYPES:
            raise ValueError(f"listing_type must be one of: {VALID_TYPES}")
        return v

    @field_validator("category_ids")
    @classmethod
    def valid_categories(cls, v: Optional[list[int]]) -> Optional[list[int]]:
        if v is not None:
            if not v:
                raise ValueError("At least one category is required")
            if len(v) > MAX_CATEGORIES:
                raise ValueError(f"Maximum {MAX_CATEGORIES} categories allowed")
        return v


# ─────────────────────────────────────────────────────────────────────────────
#  Deadline extension request (inbound — requires token)
# ─────────────────────────────────────────────────────────────────────────────

class DeadlineExtensionRequest(BaseModel):
    edit_token: str
    new_deadline: date
    reason: Optional[str] = None

    @field_validator("new_deadline")
    @classmethod
    def must_be_future(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("New deadline must be in the future")
        return v


# ─────────────────────────────────────────────────────────────────────────────
#  Admin actions
# ─────────────────────────────────────────────────────────────────────────────

class AdminAction(BaseModel):
    admin_key: str
    notes: Optional[str] = None


class AdminExtensionAction(BaseModel):
    admin_key: str
    approved: bool
    notes: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
#  Response models (outbound — no sensitive fields)
# ─────────────────────────────────────────────────────────────────────────────

class CFPBrief(BaseModel):
    id: int
    title: str
    organization: str
    deadline: str
    listing_type: str
    posted_at: str
    updated_at: str
    status: str
    categories: list[str]
    extension_count: int
    view_count: int


class CFPDetail(BaseModel):
    id: int
    title: str
    organization: str
    contact_email: str
    deadline: str
    listing_type: str
    content: str
    posted_at: str
    updated_at: str
    status: str
    categories: list[CategoryOut]
    extension_count: int
    view_count: int
    featured: bool


class CFPSubmitResponse(BaseModel):
    id: int
    title: str
    status: str
    edit_token: str
    message: str


class DeadlineExtensionOut(BaseModel):
    id: int
    cfp_id: int
    cfp_title: str
    original_deadline: str
    requested_deadline: str
    reason: Optional[str]
    requested_at: str
    status: str
    resolved_at: Optional[str]
