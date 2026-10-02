import { NotificationCenter } from '@/components/layout/notification-panel'
import { PageHeader } from '@/components/layout/app-shell'

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Notification Centre"
        subtitle="Safety alerts, assignment updates and compliance deadlines across the operator."
      />
      <NotificationCenter />
    </div>
  )
}
