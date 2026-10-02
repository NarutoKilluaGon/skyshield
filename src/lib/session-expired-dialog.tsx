import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function SessionExpiredDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" aria-describedby="session-expired-desc">
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription id="session-expired-desc">
            Your security session has expired. Please sign in again to continue your work.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="default"
            onClick={() => {
              onOpenChange(false)
              window.location.href = '/login'
            }}
          >
            Sign in again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
