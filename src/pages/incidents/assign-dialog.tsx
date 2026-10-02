import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar } from '@/components/common/avatar'
import type { Incident, User } from '@/types'

/**
 * Assign-investigator picker shared by the bulk action bar and the table's
 * row menu. `targets === null` closes the dialog; picking a user calls
 * `onAssign` with that user's id.
 */
export function AssignInvestigatorDialog({
  targets,
  investigators,
  onAssign,
  onClose,
}: {
  targets: Incident[] | null
  investigators: User[]
  onAssign: (investigatorId: string) => void
  onClose: () => void
}) {
  return (
    <Dialog open={targets !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Assign investigator</DialogTitle>
          <DialogDescription>
            {targets && targets.length === 1
              ? targets[0].ref
              : `${targets?.length ?? 0} selected records`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 px-5 pb-5">
          {investigators.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onAssign(u.id)}
              className="flex w-full items-center gap-2.5 rounded-md border border-line-soft px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
            >
              <Avatar user={u} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{u.name}</span>
                <span className="block truncate text-xs text-ink-muted">{u.title}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
