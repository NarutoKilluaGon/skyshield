import { IncidentTimeline } from '@/components/incidents/incident-timeline'
import type { DetailData } from '../shared'

/** Timeline — reconstructed sequence of the occurrence. */
export function TimelineTab({ d }: { d: DetailData }) {
  return (
    <div className="mx-auto max-w-2xl">
      <IncidentTimeline events={d.timeline} />
    </div>
  )
}
