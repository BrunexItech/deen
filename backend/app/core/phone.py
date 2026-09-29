import phonenumbers


def to_e164(raw: str, region: str = "KE") -> str:
    """Normalises 07xx / 01xx / +2547xx / 2547xx to +2547xxxxxxxx; raises ValueError."""
    try:
        parsed = phonenumbers.parse(raw, region)
    except phonenumbers.NumberParseException as exc:
        raise ValueError("Enter a valid phone number") from exc
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Enter a valid phone number")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def mask_phone(e164: str | None) -> str:
    if not e164:
        return ""
    return f"{e164[:5]}•••{e164[-3:]}"
