"""Data API routes — paths mirror ENDPOINTS in src/services/client.ts."""

from django.urls import path

from core import views

urlpatterns = [
    # incidents
    path('incidents/', views.IncidentListView.as_view(), name='incidents'),
    path('incidents/anonymous/', views.AnonymousIncidentView.as_view(), name='incidents-anonymous'),
    path('incidents/<str:incident_id>/', views.IncidentDetailView.as_view(), name='incident-detail'),
    path('incidents/<str:incident_id>/transition/', views.IncidentTransitionView.as_view(), name='incident-transition'),
    path('incidents/<str:incident_id>/reveal-reporter/', views.IncidentRevealReporterView.as_view(), name='incident-reveal'),
    path('incidents/<str:incident_id>/comments/', views.IncidentCommentsView.as_view(), name='incident-comments'),
    path('incidents/<str:incident_id>/evidence/', views.IncidentEvidenceView.as_view(), name='incident-evidence'),
    path('incidents/<str:incident_id>/timeline/', views.IncidentTimelineView.as_view(), name='incident-timeline'),
    # investigations
    path('investigations/', views.InvestigationListView.as_view(), name='investigations'),
    path('investigations/<str:investigation_id>/', views.InvestigationDetailView.as_view(), name='investigation-detail'),
    # root cause analysis
    path('rca/', views.RCAListView.as_view(), name='rca'),
    path('rca/<str:rca_id>/', views.RCADetailView.as_view(), name='rca-detail'),
    # corrective & preventive actions
    path('capa/', views.CAPAListView.as_view(), name='capa'),
    path('capa/<str:capa_id>/', views.CAPADetailView.as_view(), name='capa-detail'),
    # compliance
    path('compliance/requirements/', views.ComplianceListView.as_view(), name='compliance'),
    path('compliance/requirements/summary/', views.ComplianceSummaryView.as_view(), name='compliance-summary'),
    path('compliance/requirements/<str:requirement_id>/', views.ComplianceDetailView.as_view(), name='compliance-detail'),
    # notifications (GET list + PATCH {id,read} / {all:true} share the path)
    path('notifications/', views.NotificationView.as_view(), name='notifications'),
    # audit trail
    path('audit-log/', views.AuditLogView.as_view(), name='audit-log'),
    # media (M4 — real evidence uploads)
    path('media/', views.MediaUploadView.as_view(), name='media-upload'),
    path('media/<str:media_id>/download/', views.MediaDownloadView.as_view(), name='media-download'),
    # dashboard / analytics / reference data
    path('dashboard/metrics/', views.DashboardMetricsView.as_view(), name='dashboard-metrics'),
    path('analytics/', views.AnalyticsView.as_view(), name='analytics'),
    path('aircraft/', views.AircraftListView.as_view(), name='aircraft'),
    path('users/', views.UserListView.as_view(), name='users'),
]
