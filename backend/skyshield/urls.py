"""Root URL configuration — everything lives under /api/v1/."""

from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    """Liveness probe used by scripts/run-api-flows.mjs and deploy checks."""
    return JsonResponse({'status': 'ok', 'service': 'skyshield-api', 'version': 'm3'})


urlpatterns = [
    path('api/health/', health),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/', include('core.urls')),
]
