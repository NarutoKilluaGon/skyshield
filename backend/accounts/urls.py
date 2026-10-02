from django.urls import path

from accounts import views

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='auth-login'),
    path('logout/', views.LogoutView.as_view(), name='auth-logout'),
    path('session/', views.SessionView.as_view(), name='auth-session'),
    path('register/', views.RegisterView.as_view(), name='auth-register'),
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('password-reset/confirm/', views.PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    path('invites/', views.InviteCreateView.as_view(), name='auth-invites'),
    path('invites/<str:token>/accept/', views.InviteAcceptView.as_view(), name='auth-invite-accept'),
]
