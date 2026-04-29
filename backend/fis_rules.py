from __future__ import annotations


def normalize_discipline(discipline: str | None) -> str:
    value = (discipline or "").strip().lower()
    aliases = {
        "sbx": "snowboard",
        "snowboard cross": "snowboard",
        "snowboard": "snowboard",
        "freestyle": "freestyle",
        "freeski": "freeski",
        "ski": "freeski",
    }
    return aliases.get(value, value)


def is_supported_discipline(discipline: str | None) -> bool:
    return normalize_discipline(discipline) in {"snowboard", "freestyle", "freeski"}


def compute_official_quota(athletes_entered: int) -> int:
    """Official quota for supported disciplines: officials = athletes + 2.

    See FIS Snowboard/Freestyle/Freeski Championships rule excerpt:
    total number of officials equals number of entered athletes plus 2 team officials.
    """
    if athletes_entered <= 0:
        return 0
    return athletes_entered + 2


def compute_single_room_entitlement(officials: int) -> int:
    if officials <= 0:
        return 0
    if officials <= 3:
        return 1
    if officials <= 6:
        return 2
    return 3
