from rest_framework import serializers

from accounts.models import User


class UserSerializer(serializers.ModelSerializer):
    """Wire shape = the `User` interface in src/types (camelCase on the wire)."""

    active = serializers.BooleanField(source='is_active', read_only=True)
    license_number = serializers.CharField(allow_null=True, allow_blank=True, required=False)

    class Meta:
        model = User
        fields = [
            'id',
            'name',
            'initials',
            'role',
            'title',
            'email',
            'base',
            'phone',
            'license_number',
            'avatar_tone',
            'active',
            'last_active_at',
        ]
        read_only_fields = fields
