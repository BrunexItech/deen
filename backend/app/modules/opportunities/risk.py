"""Automated trust checks run on every submission. Flags inform reviewers; they
never approve or reject on their own."""
from __future__ import annotations

import ipaddress
import re
from datetime import timedelta
from difflib import SequenceMatcher
from urllib.parse import urlparse

from app.core.clock import utcnow

SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rb.gy",
              "shorturl.at", "tiny.cc", "rebrand.ly", "s.id"}
RISKY_TLDS = (".xyz", ".top", ".click", ".loan", ".work", ".buzz", ".rest", ".gq", ".tk", ".ml", ".cf")
FEE_PATTERNS = re.compile(
    r"(application|processing|registration|admin(istration)?|clearance|booking)\s+fee|pay\s+(ksh|kes|sh)|"
    r"send\s+money|m-?pesa\s+to|western\s+union|moneygram|guaranteed\s+(job|visa|admission)|"
    r"refundable\s+deposit|pay\s+to\s+(apply|register)",
    re.IGNORECASE,
)

WEIGHT = {"high": 40, "medium": 15, "low": 5}


def _flag(code: str, severity: str, message: str) -> dict:
    return {"code": code, "severity": severity, "message": message}


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


def scan(opp, org, similar_titles: list[tuple[str, str]]) -> tuple[list[dict], int]:
    """Returns (flags, risk_score 0-100). `similar_titles` = [(id, title)] of recent
    opportunities in the same category, for duplicate detection."""
    flags: list[dict] = []
    now = utcnow()

    if not opp.deadline and not opp.is_event:
        flags.append(_flag("no_deadline", "low", "No application deadline set"))
    elif opp.deadline and opp.deadline < now:
        flags.append(_flag("deadline_passed", "high", "The deadline has already passed"))
    elif opp.deadline and opp.deadline < now + timedelta(days=3):
        flags.append(_flag("deadline_soon", "medium", "Closes in under 3 days — little time to review and publish"))
    if len(opp.description or "") < 150:
        flags.append(_flag("thin_description", "medium", "Description is very short"))
    if not (opp.eligibility or opp.education_levels or opp.min_age or opp.max_age or opp.counties):
        flags.append(_flag("no_eligibility", "low", "No eligibility information"))
    if opp.apply_mode.value == "external":
        url = opp.external_url or ""
        if not url:
            flags.append(_flag("missing_link", "high", "External application but no link"))
        else:
            host = _host(url)
            if not url.lower().startswith("https://"):
                flags.append(_flag("insecure_link", "medium", "Application link is not HTTPS"))
            if host in SHORTENERS:
                flags.append(_flag("shortened_link", "high", f"Link uses a URL shortener ({host}) that hides the destination"))
            try:
                ipaddress.ip_address(host)
                flags.append(_flag("ip_link", "high", "Link points to a bare IP address"))
            except ValueError:
                pass
            if host.endswith(RISKY_TLDS):
                flags.append(_flag("risky_domain", "medium", f"Link domain ({host}) is commonly used for spam"))
            org_host = _host(org.website) if org and org.website else ""
            if org_host and host and not (host == org_host or host.endswith("." + org_host)):
                flags.append(_flag("domain_mismatch", "low", f"Link ({host}) differs from the organization's website ({org_host})"))
    text = " ".join(filter(None, [opp.title, opp.summary, opp.description, opp.requirements,
                                  opp.application_process, opp.eligibility]))
    if m := FEE_PATTERNS.search(text):
        flags.append(_flag("asks_for_money", "high", f'Mentions payment: "{m.group(0)}" — legitimate opportunities never charge applicants'))
    title = (opp.title or "").lower().strip()
    for other_id, other_title in similar_titles:
        if other_id != opp.id and SequenceMatcher(None, title, (other_title or "").lower()).ratio() > 0.86:
            flags.append(_flag("possible_duplicate", "medium", f'Very similar to "{other_title}"'))
            break
    if org and org.verification.value == "pending":
        flags.append(_flag("org_unverified", "medium", "Organization is not yet verified"))

    score = min(100, sum(WEIGHT[f["severity"]] for f in flags))
    return flags, score
