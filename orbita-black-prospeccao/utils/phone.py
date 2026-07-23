import re


def normalize_phone(phone: str) -> str:
    """Só dígitos; prefixa '55' se sobrarem 10-11 dígitos (DDD + número, sem código de país)."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) in (10, 11):
        return "55" + digits
    return digits
