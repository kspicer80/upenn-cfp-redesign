"""
config.py — App-wide settings loaded from environment variables.
Copy .env.example to .env and fill in your values before running.
"""

import os
import secrets
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Admin key — change this! Used to access moderation endpoints.
    admin_key: str = os.getenv("ADMIN_KEY", "change-me-before-deploying")

    # Email settings (optional — token is printed to logs if not configured)
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    email_from: str = os.getenv("EMAIL_FROM", "noreply@cfpcommons.org")

    # Site settings
    site_name: str = "CFP Commons"
    site_url: str = os.getenv("SITE_URL", "http://localhost:8000")

    # Moderation — set to False to auto-approve all new submissions
    require_approval: bool = os.getenv("REQUIRE_APPROVAL", "true").lower() == "true"

    # Deadline extension — set to False to auto-approve valid extension requests
    require_extension_approval: bool = (
        os.getenv("REQUIRE_EXTENSION_APPROVAL", "true").lower() == "true"
    )

    # Maximum months a deadline can be extended beyond original post date
    max_extension_months: int = int(os.getenv("MAX_EXTENSION_MONTHS", "6"))

    # NEW — Free-tier hosting support: auto-seed sample CFPs whenever
    # database.py finds an empty cfps table (e.g. after Render's free
    # instance wipes its ephemeral disk on every redeploy/cold start).
    # Set to "false" once real submissions start coming in for real, or
    # once you've moved to a paid plan with persistent storage.
    auto_seed_demo_data: bool = os.getenv("AUTO_SEED_DEMO_DATA", "true").lower() == "true"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


# ─────────────────────────────────────────────────────────────────────────────
#  Utility helpers
# ─────────────────────────────────────────────────────────────────────────────

def generate_token(nbytes: int = 32) -> str:
    """URL-safe cryptographic token for edit links."""
    return secrets.token_urlsafe(nbytes)


def now_iso() -> str:
    """Current UTC datetime as ISO string."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def slugify(text: str) -> str:
    """Very simple slug — good enough for category slugs."""
    import re
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


async def send_submission_email(to: str, title: str, edit_token: str, cfp_id: int, settings):
    """
    Send the edit token to the submitter.
    Falls back to logging if SMTP is not configured — useful for local dev
    and for Render's free tier (SMTP creds cost nothing extra to skip).
    """
    import logging
    logger = logging.getLogger("cfp.email")

    edit_url = f"{settings.site_url}/api/cfps/{cfp_id}/edit?token={edit_token}"
    extend_url = f"{settings.site_url}/api/cfps/{cfp_id}/extend-deadline"

    body = f"""
Thank you for submitting to {settings.site_name}!

Your listing "{title}" has been received and is pending review.

── Your edit link ──────────────────────────────────────────
Keep this token safe — it's the only way to edit your listing
or request a deadline extension.

Edit token:  {edit_token}
Edit URL:    {edit_url}
Extend URL:  {extend_url}
────────────────────────────────────────────────────────────

Questions? Reply to this email.
"""

    if not settings.smtp_host:
        logger.info(
            "SMTP not configured. Submission email would have been sent to %s\n%s",
            to, body
        )
        return

    import smtplib
    from email.message import EmailMessage

    msg = EmailMessage()
    msg["Subject"] = f"[{settings.site_name}] CFP Submitted: {title}"
    msg["From"] = settings.email_from
    msg["To"] = to
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
