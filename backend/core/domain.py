"""
Domain constants ported 1:1 from src/lib/domain.ts.

The server is the authority for these values — the client keeps its copies for
optimistic UI, but every guard, filter and sort here must agree with the
frontend so the two never disagree about what a record means.
"""

SEVERITY_VALUE = {
    'critical': 5,
    'high': 4,
    'medium': 3,
    'low': 2,
    'negligible': 1,
}

SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'negligible']

INCIDENT_STATUS_ORDER = ['draft', 'reported', 'investigation', 'rca_pending', 'capa', 'closed']

INCIDENT_STATUS_LABEL = {
    'draft': 'Draft',
    'reported': 'Reported',
    'investigation': 'Investigation',
    'rca_pending': 'RCA Pending',
    'capa': 'CAPA',
    'closed': 'Closed',
}

CATEGORY_LABEL = {
    'engine_issue': 'Engine Issue',
    'bird_strike': 'Bird Strike',
    'runway_excursion': 'Runway Excursion',
    'cabin_issue': 'Cabin Issue',
    'hydraulic_failure': 'Hydraulic Failure',
    'avionics_fault': 'Avionics Fault',
    'fuel_system': 'Fuel System',
    'tire_brake': 'Tyre / Brake',
    'pressurisation': 'Pressurisation',
    'ground_damage': 'Ground Damage',
    'fatigue_risk': 'Fatigue Risk',
    'near_miss': 'Near Miss',
}

# RISK_BANDS from domain.ts: score ≤ max → level.
RISK_BANDS = [(4, 'low'), (9, 'moderate'), (14, 'high'), (25, 'critical')]


def risk_level(score: int) -> str:
    for maximum, level in RISK_BANDS:
        if score <= maximum:
            return level
    return 'critical'


def risk_score(severity: str, likelihood: int) -> int:
    return SEVERITY_VALUE.get(severity, 0) * int(likelihood)
