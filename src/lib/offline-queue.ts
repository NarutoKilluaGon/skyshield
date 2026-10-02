/**
 * Offline quick-report queue (master 5.8).
 *
 * When the device is offline, a completed quick report is written to
 * `skyshield.offline.queue.v1` instead of being lost; the report page flushes
 * the queue through the real service on mount and on the `online` event. The
 * queue holds the exact `createIncident` payload, so a queued report files
 * identically to a connected one. Pure storage helpers are unit-tested.
 */
import type { Incident } from '@/types'
import { createIncident, ConflictError, WorkflowError } from '@/services/incidents'
import { HttpError } from '@/services/client'

export const QUEUE_KEY = 'skyshield.offline.queue.v1'

export interface QueuedReport {
  id: string
  payload: Partial<Incident>
  queuedAt: string
  /**
   * M5: stable Idempotency-Key for the eventual POST. A flush that times out
   * client-side after the server already filed the report replays the stored
   * answer on retry instead of filing a duplicate.
   */
  idempotencyKey?: string
}

/** Stable key for a queued item (also covers entries queued before M5). */
export function idempotencyKeyFor(item: QueuedReport): string {
  return item.idempotencyKey ?? `offline_${item.id}`
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function readQueue(): QueuedReport[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueuedReport[]
    return Array.isArray(parsed) ? parsed.filter((q) => q && q.id && q.payload) : []
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedReport[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    /* storage full or unavailable — nothing else we can honestly do */
  }
}

export function enqueueReport(payload: Partial<Incident>): QueuedReport {
  const item: QueuedReport = {
    id: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    payload,
    queuedAt: new Date().toISOString(),
  }
  item.idempotencyKey = `offline_${item.id}`
  writeQueue([...readQueue(), item])
  return item
}

export function removeQueued(id: string): void {
  writeQueue(readQueue().filter((q) => q.id !== id))
}

export function clearQueue(): void {
  writeQueue([])
}

/**
 * A rejection the queue can act on: the server understood the report and
 * refused it (canonical 422 workflow shape, 409 conflict, or any other 4xx
 * except 429). Retrying those forever would be dishonest — they leave the
 * queue and are surfaced to the reporter. Network failures, 429s and 5xx
 * stay queued for the next flush.
 */
function isPermanentRejection(e: unknown): boolean {
  if (e instanceof WorkflowError || e instanceof ConflictError) return true
  return e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 429
}

export interface QueueFlushResult {
  /** Refs that were filed. */
  filed: string[]
  /** Titles the server permanently rejected — dropped from the queue. */
  rejected: string[]
}

/** File every queued report in order; returns filed refs and rejections. */
export async function processQueue(): Promise<QueueFlushResult> {
  const filed: string[] = []
  const rejected: string[] = []
  for (const item of readQueue()) {
    try {
      const created = await createIncident(item.payload, {
        idempotencyKey: idempotencyKeyFor(item),
      })
      removeQueued(item.id)
      filed.push(created.ref)
    } catch (e) {
      if (isPermanentRejection(e)) {
        removeQueued(item.id)
        rejected.push(item.payload.title ?? 'queued report')
        continue
      }
      // Transient failure — keep the item queued; the next online event retries.
      break
    }
  }
  return { filed, rejected }
}
