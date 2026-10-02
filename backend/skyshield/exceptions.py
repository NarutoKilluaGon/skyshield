"""
Uniform error envelope.

The frontend surfaces `detail.message` (auth transport) and `detail.reason`
(workflow transport), so every DRF exception is normalised to
`{"message": "<human readable>"}` while preserving the status code —
including 429 + Retry-After (client.ts reads both).
"""

from rest_framework.views import exception_handler


def first_message(detail) -> str:
    """Flatten DRF's detail shapes (str | list | dict) into one sentence."""
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        return first_message(detail[0]) if detail else 'Request failed.'
    if isinstance(detail, dict):
        # Prefer an explicit message, else the first field error.
        if 'message' in detail:
            return first_message(detail['message'])
        if 'detail' in detail:
            return first_message(detail['detail'])
        if 'reason' in detail:
            return first_message(detail['reason'])
        for value in detail.values():
            return first_message(value)
    return 'Request failed.'


def skyshield_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    if isinstance(data, dict) and ('message' in data or 'reason' in data):
        # Already in the contract shape (workflow 422 keeps `reason`).
        return response
    response.data = {'message': first_message(data)}
    return response
