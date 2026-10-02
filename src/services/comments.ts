/**
 * Incident comments with @mentions (master 5.7).
 *
 * `parseMentions` is pure and unit-tested: it matches "@Name", "@initials"
 * and "@email-local-part" against the active user directory. Adding a
 * comment writes the comment AND a targeted notification per mentioned user
 * (`forUserId`) in the same store transaction — notifications generated from
 * real events, delivered only to the person they concern.
 */
import type { IncidentComment, User } from '@/types'
import { api, delay, ENDPOINTS } from './client'
import { db, newId, persist, storeIncidentById } from './store'
import { USERS } from '@/data/users'

/** Match a body against the user directory; returns unique user ids. */
export function parseMentions(body: string, users: Pick<User, 'id' | 'name' | 'initials' | 'email'>[]): string[] {
  const found = new Set<string>()
  const lower = body.toLowerCase()
  for (const u of users) {
    if (!u?.name) continue
    const candidates = [
      `@${u.name.toLowerCase()}`,
      `@${u.initials.toLowerCase()}`,
      `@${u.email.split('@')[0].toLowerCase()}`,
    ]
    if (candidates.some((c) => lower.includes(c))) found.add(u.id)
  }
  return [...found]
}

export async function getComments(incidentId: string): Promise<IncidentComment[]> {
  if (!api.enabled) return api.get<IncidentComment[]>(`${ENDPOINTS.incident(incidentId)}comments/`)
  await delay(90)
  return db.comments
    .filter((c) => c.incidentId === incidentId)
    .sort((a, b) => a.at.localeCompare(b.at))
}

export async function addComment(
  incidentId: string,
  authorId: string,
  body: string,
): Promise<IncidentComment> {
  if (!api.enabled) {
    // The server derives the author from the session, parses @mentions and
    // fans out the targeted notifications in the same transaction.
    const comment = await api.post<IncidentComment>(
      `${ENDPOINTS.incident(incidentId)}comments/`,
      { body },
    )
    db.comments.push(comment)
    persist()
    return comment
  }
  await delay(180)
  const text = body.trim()
  if (!text) throw new Error('Comment is empty.')
  const incident = storeIncidentById(incidentId)
  const mentions = parseMentions(text, USERS.filter((u) => u.active && u.id !== authorId))
  const now = new Date().toISOString()

  const comment: IncidentComment = {
    id: newId('cmt'),
    incidentId,
    authorId,
    at: now,
    body: text,
    mentions,
  }
  db.comments.push(comment)

  // One targeted notification per mentioned user, in the same transaction.
  if (mentions.length && incident) {
    const author = USERS.find((u) => u.id === authorId)?.name ?? 'A colleague'
    db.notifications = [
      ...mentions.map((uid) => ({
        id: newId('ntf'),
        title: `${author} mentioned you on ${incident.ref}`,
        body: text.length > 110 ? `${text.slice(0, 110)}…` : text,
        severity: 'info' as const,
        category: 'assignment' as const,
        at: now,
        read: false,
        link: `/incidents/${incidentId}`,
        actor: author,
        forUserId: uid,
      })),
      ...db.notifications,
    ]
  }

  persist()
  return comment
}
