import type { AppNotification } from '@/types'
import { api, delay, ENDPOINTS } from './client'
import { db, persist } from './store'

export async function getNotifications(): Promise<AppNotification[]> {
  if (!api.enabled) {
    const rows = await api.get<AppNotification[]>(ENDPOINTS.notifications)
    db.notifications = rows
    persist()
    return rows
  }
  await delay(100)
  return db.notifications
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!api.enabled) {
    await api.patch(ENDPOINTS.notifications, { id, read: true })
    db.notifications = db.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    persist()
    return
  }
  await delay(60)
  db.notifications = db.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
  persist()
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!api.enabled) {
    await api.patch(ENDPOINTS.notifications, { all: true })
    db.notifications = db.notifications.map((n) => ({ ...n, read: true }))
    persist()
    return
  }
  await delay(90)
  db.notifications = db.notifications.map((n) => ({ ...n, read: true }))
  persist()
}
