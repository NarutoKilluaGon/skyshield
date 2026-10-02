import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Avatar } from '@/components/common/avatar'
import { Skeleton } from '@/components/ui/primitives'
import { addComment, getComments, parseMentions } from '@/services/comments'
import { USERS, userById, userName } from '@/data/users'
import { useAuth } from '@/lib/auth'
import { fmtRelative } from '@/lib/format'
import type { IncidentComment } from '@/types'

/** Render the body with @mentions highlighted in brand. */
function CommentBody({ body }: { body: string }) {
  const mentionIds = useMemo(() => parseMentions(body, USERS), [body])
  if (!mentionIds.length) return <>{body}</>
  const names = mentionIds
    .flatMap((id) => {
      const u = userById(id)
      return [u?.name, u?.initials, u?.email.split('@')[0]].filter(Boolean) as string[]
    })
    .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = body.split(new RegExp(`(@(?:${names.join('|')}))`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="font-medium text-brand">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}

/**
 * Comments thread for an incident record: real persistence, @mention
 * detection against the user directory, targeted notifications on submit.
 */
export function IncidentComments({ incidentId }: { incidentId: string }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<IncidentComment[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let live = true
    setLoading(true)
    getComments(incidentId)
      .then((c) => live && setComments(c))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [incidentId])

  const detected = useMemo(
    () => parseMentions(draft, USERS.filter((u) => u.active && u.id !== user?.id)),
    [draft, user?.id],
  )

  const submit = async () => {
    if (!draft.trim() || !user) return
    setSending(true)
    try {
      const created = await addComment(incidentId, user.id, draft)
      setComments((prev) => [...prev, created])
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="p-4" data-comments>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <MessageSquare className="size-3.5 text-ink-muted" />
        Comments
        {comments.length > 0 && (
          <span className="rounded bg-surface-3 px-1.5 py-px text-xs font-semibold text-ink-muted tnum">
            {comments.length}
          </span>
        )}
      </h3>

      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-9" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : comments.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          No comments yet. Use comments to coordinate the response — mention colleagues with @
          (e.g. <span className="font-mono text-ink-soft">@R. Singh</span>) to notify them.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Avatar user={userById(c.authorId)} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="text-sm font-medium text-ink">{userName(c.authorId)}</span>
                  <span className="text-ink-muted">{fmtRelative(c.at)}</span>
                  {c.mentions.length > 0 && (
                    <span className="text-ink-faint">· {c.mentions.length} mentioned</span>
                  )}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                  <CommentBody body={c.body} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3.5 border-t border-line-soft pt-3">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment… use @name to mention"
          aria-label="New comment"
          className="text-sm"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-ink-muted">
            {detected.length
              ? `Will notify: ${detected.map((id) => userName(id)).join(', ')}`
              : 'Mentions notify the person directly.'}
          </span>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!draft.trim() || sending}
            onClick={submit}
            data-send-comment
          >
            <Send className="size-3.5" /> Comment
          </Button>
        </div>
      </div>
    </Card>
  )
}
