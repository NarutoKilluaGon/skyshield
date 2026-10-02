// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  QUEUE_KEY,
  clearQueue,
  enqueueReport,
  idempotencyKeyFor,
  isOffline,
  processQueue,
  readQueue,
  removeQueued,
} from './offline-queue'

vi.mock('@/services/incidents', () => {
  class WorkflowError extends Error {}
  class ConflictError extends Error {}
  return { createIncident: vi.fn(), WorkflowError, ConflictError }
})

describe('offline queue storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts empty', () => {
    expect(readQueue()).toEqual([])
  })

  it('round-trips an enqueued payload', () => {
    const item = enqueueReport({ title: 'Probe', description: 'x'.repeat(40) })
    const queue = readQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe(item.id)
    expect(queue[0].payload.title).toBe('Probe')
    expect(queue[0].queuedAt).toBeTruthy()
  })

  it('assigns a stable idempotency key at enqueue time (M5)', () => {
    const item = enqueueReport({ title: 'Keyed probe', description: 'x'.repeat(40) })
    expect(item.idempotencyKey).toBe(`offline_${item.id}`)
    expect(idempotencyKeyFor(item)).toBe(item.idempotencyKey)
    // Entries queued before M5 had no key — the derived fallback is stable.
    expect(idempotencyKeyFor({ id: 'q_legacy', payload: {}, queuedAt: '' })).toBe(
      'offline_q_legacy',
    )
  })

  it('preserves FIFO order across enqueues', () => {
    const a = enqueueReport({ title: 'first' })
    const b = enqueueReport({ title: 'second' })
    expect(readQueue().map((q) => q.id)).toEqual([a.id, b.id])
  })

  it('removes exactly the requested item', () => {
    const a = enqueueReport({ title: 'first' })
    enqueueReport({ title: 'second' })
    removeQueued(a.id)
    const left = readQueue()
    expect(left).toHaveLength(1)
    expect(left[0].payload.title).toBe('second')
  })

  it('clears completely', () => {
    enqueueReport({ title: 'a' })
    enqueueReport({ title: 'b' })
    clearQueue()
    expect(readQueue()).toEqual([])
    expect(window.localStorage.getItem(QUEUE_KEY)).toBe('[]')
  })

  it('survives corrupt storage gracefully', () => {
    window.localStorage.setItem(QUEUE_KEY, '{not json')
    expect(readQueue()).toEqual([])
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify({ nonsense: true }))
    expect(readQueue()).toEqual([])
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify([{ noId: true }, null]))
    expect(readQueue()).toEqual([])
  })

  it('reports online by default in jsdom', () => {
    expect(isOffline()).toBe(false)
  })
})

describe('processQueue', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('files queued reports with their stable idempotency key', async () => {
    const { createIncident } = await import('@/services/incidents')
    vi.mocked(createIncident).mockResolvedValue({ ref: 'P_006-901' } as never)
    const item = enqueueReport({ title: 'Queued probe', description: 'x'.repeat(40) })

    const result = await processQueue()

    expect(result).toEqual({ filed: ['P_006-901'], rejected: [] })
    expect(createIncident).toHaveBeenCalledWith(item.payload, {
      idempotencyKey: item.idempotencyKey,
    })
    expect(readQueue()).toEqual([])
  })

  it('drops reports the server permanently rejected (canonical 422 shape)', async () => {
    const { createIncident, WorkflowError } = await import('@/services/incidents')
    vi.mocked(createIncident).mockRejectedValue(new WorkflowError('severity is required'))
    enqueueReport({ title: 'Bad probe', description: 'x'.repeat(40) })

    const result = await processQueue()

    expect(result.filed).toEqual([])
    expect(result.rejected).toEqual(['Bad probe'])
    expect(readQueue()).toEqual([])
  })

  it('keeps transient failures queued for the next flush', async () => {
    const { createIncident } = await import('@/services/incidents')
    vi.mocked(createIncident).mockRejectedValue(new Error('network unreachable'))
    enqueueReport({ title: 'Transient probe', description: 'x'.repeat(40) })

    const result = await processQueue()

    expect(result).toEqual({ filed: [], rejected: [] })
    expect(readQueue()).toHaveLength(1)
  })
})
