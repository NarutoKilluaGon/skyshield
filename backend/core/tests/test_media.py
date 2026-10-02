"""M4 — real evidence uploads: hashing, storage, linking and download."""

import hashlib
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status

from core.models import CAPA, AuditLog, ComplianceRequirement, EvidenceItem, Incident
from core.tests.base import SeededAPITestCase

_temp_media = tempfile.mkdtemp(prefix='skyshield-test-media-')


@override_settings(MEDIA_ROOT=_temp_media)
class MediaUploadTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()  # j.miller — any authenticated user may register evidence

    def _incident(self):
        return Incident.objects.order_by('list_order').first()

    def test_upload_registers_hash_and_links_to_incident(self):
        incident = self._incident()
        before = incident.evidence_count
        payload = b'skyshield probe bytes \x00\x01\x02'
        response = self.client.post(
            '/api/v1/media/',
            {
                'file': SimpleUploadedFile('probe.png', payload, content_type='image/png'),
                'incidentId': incident.id,
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        media = response.json()['media']
        self.assertEqual(media['name'], 'probe.png')
        self.assertEqual(media['kind'], 'image')
        self.assertEqual(media['hash'], hashlib.sha256(payload).hexdigest())
        self.assertTrue(media['verified'])
        self.assertTrue(media['url'].endswith(f"/api/v1/media/{media['id']}/download/"))
        self.assertEqual(media['sizeKb'], max(1, round(len(payload) / 1024)))

        incident.refresh_from_db()
        self.assertEqual(incident.evidence_count, before + 1)

        listing = self.client.get(f'/api/v1/incidents/{incident.id}/evidence/')
        self.assertIn(media['id'], [row['id'] for row in listing.json()])

        audit = AuditLog.objects.filter(entity_id=incident.id, action='evidence.upload').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.to, 'probe.png')

    def test_download_returns_the_exact_bytes(self):
        incident = self._incident()
        payload = b'chain-of-custody payload'
        uploaded = self.client.post(
            '/api/v1/media/',
            {'file': SimpleUploadedFile('note.txt', payload, content_type='text/plain'), 'incidentId': incident.id},
            format='multipart',
        ).json()['media']
        response = self.client.get(uploaded['url'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b''.join(response.streaming_content), payload)
        self.assertIn('attachment', response.headers.get('Content-Disposition', ''))
        item = EvidenceItem.objects.get(pk=uploaded['id'])
        self.assertEqual(item.kind, 'log')  # text/* maps to log extracts
        self.assertTrue(item.file.name.startswith('evidence/'))

    def test_kind_mapping(self):
        incident = self._incident()
        cases = [
            ('clip.mp4', 'video/mp4', 'video'),
            ('report.pdf', 'application/pdf', 'pdf'),
            ('sheet.xlsx', 'application/vnd.ms-excel', 'document'),
            ('extract.log', 'application/octet-stream', 'log'),
        ]
        for name, content_type, expected in cases:
            uploaded = self.client.post(
                '/api/v1/media/',
                {'file': SimpleUploadedFile(name, b'x' * 16, content_type=content_type), 'incidentId': incident.id},
                format='multipart',
            ).json()['media']
            self.assertEqual(uploaded['kind'], expected, name)

    def test_missing_file_or_incident_is_422(self):
        response = self.client.post('/api/v1/media/', {}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        response = self.client.post(
            '/api/v1/media/',
            {'file': SimpleUploadedFile('a.png', b'1234', content_type='image/png')},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)

    def test_unknown_incident_is_404_and_leaves_no_orphans(self):
        before = EvidenceItem.objects.count()
        response = self.client.post(
            '/api/v1/media/',
            {'file': SimpleUploadedFile('a.png', b'1234', content_type='image/png'), 'incidentId': 'inc_missing'},
            format='multipart',
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(EvidenceItem.objects.count(), before)

    @override_settings(SKYSHIELD_MAX_UPLOAD_MB=0)
    def test_oversize_upload_is_rejected(self):
        incident = self._incident()
        before = EvidenceItem.objects.count()
        response = self.client.post(
            '/api/v1/media/',
            {'file': SimpleUploadedFile('big.bin', b'x' * 2048, content_type='application/octet-stream'), 'incidentId': incident.id},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(EvidenceItem.objects.count(), before)

    def test_requires_authentication(self):
        self.client.logout()
        response = self.client.post(
            '/api/v1/media/',
            {'file': SimpleUploadedFile('a.png', b'1234', content_type='image/png'), 'incidentId': 'x'},
            format='multipart',
        )
        self.assertIn(response.status_code, (401, 403))

    def test_compliance_attachment_appends_descriptor(self):
        requirement = ComplianceRequirement.objects.order_by('list_order').first()
        before = len(requirement.attachments or [])
        payload = b'audit certificate bytes'
        response = self.client.post(
            '/api/v1/media/',
            {
                'file': SimpleUploadedFile('cert.pdf', payload, content_type='application/pdf'),
                'entityType': 'compliance',
                'entityId': requirement.id,
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        data = response.json()
        self.assertEqual(data['media']['hash'], hashlib.sha256(payload).hexdigest())
        requirement = ComplianceRequirement.objects.get(pk=requirement.id)
        self.assertEqual(len(requirement.attachments), before + 1)
        descriptor = requirement.attachments[-1]
        self.assertEqual(descriptor['name'], 'cert.pdf')
        self.assertEqual(descriptor['hash'], hashlib.sha256(payload).hexdigest())
        self.assertEqual(descriptor['mediaId'], data['media']['id'])
        self.assertEqual(data['requirement']['id'], requirement.id)
        self.assertTrue(AuditLog.objects.filter(entity_id=requirement.id, action='evidence.attach').exists())

    def test_capa_attachment_appends_descriptor(self):
        capa = CAPA.objects.order_by('list_order').first()
        before = len(capa.attachments or [])
        response = self.client.post(
            '/api/v1/media/',
            {
                'file': SimpleUploadedFile('fix-photo.jpg', b'jpegbytes', content_type='image/jpeg'),
                'entityType': 'capa',
                'entityId': capa.id,
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        capa = CAPA.objects.get(pk=capa.id)
        self.assertEqual(len(capa.attachments), before + 1)
        self.assertEqual(capa.attachments[-1]['name'], 'fix-photo.jpg')
        self.assertEqual(response.json()['capa']['id'], capa.id)
