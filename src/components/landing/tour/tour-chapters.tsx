/**
 * Chapter content for the How-it-works guided tour.
 *
 * The tour is written to be *presented*: each chapter is one idea, with a
 * short lede, three or four detail bullets, a one-line takeaway the presenter
 * can read aloud, and an animated visual that reinforces the point.
 * All claims mirror the real application (routes, roles, workflow guards and
 * the data-layer contract documented in the README).
 */
import type { LucideIcon } from 'lucide-react'
import {
  Radar,
  FilePlus2,
  Crosshair,
  Microscope,
  GitBranch,
  ListChecks,
  ShieldCheck,
  BarChart3,
  Users,
  Layers,
} from 'lucide-react'
import {
  LoopVisual,
  ReportVisual,
  TriageVisual,
  InvestigateVisual,
  RcaVisual,
  CapaVisual,
  CloseVisual,
  InsightsVisual,
  RolesVisual,
  PlatformVisual,
} from './tour-visuals'

export interface TourBullet {
  title: string
  body: string
}

export interface TourChapter {
  id: string
  /** Short label for the chapter rail. */
  label: string
  icon: LucideIcon
  title: string
  lede: string
  bullets: TourBullet[]
  /** One sentence a presenter can read aloud to land the point. */
  takeaway: string
  visual: () => React.ReactElement
  /** Screen name shown in the rail subline ("where to see it in the app"). */
  screen?: string
}

export const TOUR_CHAPTERS: TourChapter[] = [
  {
    id: 'overview',
    label: 'The big picture',
    icon: Radar,
    title: 'What is SkyShield?',
    lede: 'SkyShield is an aviation safety management system: one platform that carries a safety report from first sighting to verified closure, so no occurrence is lost in an inbox, a spreadsheet or a paper form.',
    bullets: [
      {
        title: 'One register',
        body: 'Every occurrence — from the flight deck, line maintenance or ground operations — lands in a single searchable incident register with a permanent reference.',
      },
      {
        title: 'One workflow',
        body: 'Every report moves through the same stages: report, assess, investigate, analyse, act, verify. The system enforces the order and remembers every step.',
      },
      {
        title: 'One source of truth',
        body: 'Risk scores, ownership, SLA countdowns and the audit trail update live — the dashboard, the analytics and this landing page all read the same data.',
      },
    ],
    takeaway:
      'A safety report that does not end in a verified corrective action is paperwork. SkyShield exists to close the loop.',
    visual: LoopVisual,
  },
  {
    id: 'report',
    label: 'Report',
    icon: FilePlus2,
    title: 'Step 1 — Report an occurrence',
    lede: 'Anyone in the operation can file a report. A seven-step wizard captures the what, where, when and who without ambiguity — and a public anonymous channel exists for confidential reports.',
    bullets: [
      {
        title: 'Structured capture',
        body: 'Flight number, aircraft registration, airport, phase of flight and a narrative are validated step by step, so investigators never have to guess.',
      },
      {
        title: 'Live risk preview',
        body: 'As severity and likelihood are chosen, the risk score and band are computed instantly and shown in a sticky rail before submission.',
      },
      {
        title: 'Evidence attached at the source',
        body: 'Photos, documents and telemetry exports are drag-and-dropped onto the record while the details are still fresh.',
      },
      {
        title: 'Anonymous intake',
        body: 'A public /report form accepts confidential reports with throttling and honeypot spam protection — supporting a just safety culture.',
      },
    ],
    takeaway: 'The wizard does the structuring, so the quality of a report does not depend on who writes it.',
    visual: ReportVisual,
    screen: 'Report incident',
  },
  {
    id: 'triage',
    label: 'Assess',
    icon: Crosshair,
    title: 'Step 2 — Triage & risk assessment',
    lede: 'A safety manager reviews each new report and grades it on the ICAO 5×5 matrix: severity × likelihood yields a 1–25 risk score in one of four bands.',
    bullets: [
      {
        title: 'Calibrated bands',
        body: 'Low, moderate, high and critical — always shown as text plus colour, never colour alone, and consistent across the whole platform.',
      },
      {
        title: 'The SLA clock starts',
        body: 'Critical findings open regulatory notification windows (24–48h flags for authorities such as DGCA/AAIB), and every action gets a countdown.',
      },
      {
        title: 'Assignment',
        body: 'An investigator is assigned, the reporter is notified, and the record transitions from new to triaged with an audit entry.',
      },
    ],
    takeaway: 'Triage turns “something happened” into “this is how serious it is, and this is who owns it”.',
    visual: TriageVisual,
    screen: 'Risk matrix',
  },
  {
    id: 'investigate',
    label: 'Investigate',
    icon: Microscope,
    title: 'Step 3 — Investigate',
    lede: 'The assigned investigator builds the case inside the incident record itself — eight tabs keep the overview, risk, investigation, evidence, timeline, RCA, CAPA and audit history in one place.',
    bullets: [
      {
        title: 'Timeline reconstruction',
        body: 'Events are sequenced from the report, evidence timestamps and interviews, all displayed in UTC with local tooltips.',
      },
      {
        title: 'Evidence chain',
        body: 'Every attachment records who added it and when, so the case file stands up to audit.',
      },
      {
        title: 'Status with guards',
        body: 'The workflow only allows valid transitions; the record always states where it is and what is blocking the next step.',
      },
    ],
    takeaway: 'The investigator should never chase information — the record brings it to them.',
    visual: InvestigateVisual,
    screen: 'Active investigations',
  },
  {
    id: 'rca',
    label: 'Analyse',
    icon: GitBranch,
    title: 'Step 4 — Root cause analysis',
    lede: 'An editable 5 Whys chain drives from the symptom down to the verified root cause, with contributing factors classified as human, technical, environmental, organisational or procedural.',
    bullets: [
      {
        title: '5 Whys, kept with the incident',
        body: 'Each answer becomes the next question; levels can be added, edited or removed, and the final level is marked as the root cause.',
      },
      {
        title: 'Factor classification',
        body: 'Contributing factors are grouped and weighted, so systemic patterns become visible across the register.',
      },
      {
        title: 'Causes drive actions',
        body: 'Every root cause maps to corrective actions — no orphan findings, no fix without a cause.',
      },
    ],
    takeaway: 'Fixing the symptom returns the aircraft; fixing the root cause keeps the next one safe.',
    visual: RcaVisual,
    screen: '5 Whys workspace',
  },
  {
    id: 'capa',
    label: 'Act',
    icon: ListChecks,
    title: 'Step 5 — Corrective & preventive actions',
    lede: 'Findings become tracked CAPAs: each action has a named owner, a due date and an SLA countdown that everyone can see.',
    bullets: [
      {
        title: 'Ownership and escalation',
        body: 'Overdue actions turn critical-wash with “N days overdue”; nobody can pretend an action belongs to someone else.',
      },
      {
        title: 'Evidence on completion',
        body: 'Marking an action complete requires attaching proof — a completion without evidence does not count.',
      },
      {
        title: 'Verification of effectiveness',
        body: 'A safety manager verifies the action actually reduced the risk before it is accepted as done.',
      },
    ],
    takeaway: 'An action without an owner and a deadline is a wish, not a plan.',
    visual: CapaVisual,
    screen: 'CAPA tracking',
  },
  {
    id: 'close',
    label: 'Verify & close',
    icon: ShieldCheck,
    title: 'Step 6 — Verify & close',
    lede: 'An incident closes only when the investigation is complete, every CAPA is done and effectiveness is verified — the workflow refuses anything less and says why.',
    bullets: [
      {
        title: 'Transition guards',
        body: 'The system blocks closure with open CAPAs or an unfinished investigation; the disabled button explains the reason.',
      },
      {
        title: 'Tamper-evident audit trail',
        body: 'Every status change, edit and assignment is logged with actor and timestamp, exportable as an audit history.',
      },
      {
        title: 'Regulatory readiness',
        body: 'Closed records form occurrence packages for DGCA/AAIB/ICAO oversight without last-minute archaeology.',
      },
    ],
    takeaway: 'Closure is not a button — it is a state the record has to earn.',
    visual: CloseVisual,
    screen: 'Incident detail · Audit history',
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    title: 'See the whole picture',
    lede: 'The dashboard, analytics and compliance modules roll the register up into the safety picture: what needs attention today, where risk sits, and whether the organisation is audit-ready.',
    bullets: [
      {
        title: 'Dashboard',
        body: 'A needs-attention hero, a four-cell KPI strip, an interactive 5×5 risk matrix you can click through, and a personal queue.',
      },
      {
        title: 'Analytics & reports',
        body: 'Trend and distribution charts with working filters, CSV export of the filtered set, and print-to-PDF summaries.',
      },
      {
        title: 'Compliance',
        body: 'An overall score, per-category breakdown, audit countdown and a requirements register with evidence and owners.',
      },
      {
        title: 'Notifications',
        body: 'An in-app panel and a full centre, grouped by day and weighted by severity — the system pushes, you do not poll.',
      },
    ],
    takeaway: 'Every figure is computed from the same register the operational modules read — nothing is hard-coded.',
    visual: InsightsVisual,
    screen: 'Dashboard · Analytics · Compliance',
  },
  {
    id: 'roles',
    label: 'Roles',
    icon: Users,
    title: 'Who uses it',
    lede: 'Five roles share one system with calibrated permissions: reporters file, investigators dig, safety managers decide, auditors inspect, and administrators govern.',
    bullets: [
      {
        title: 'Safety officer',
        body: 'Files occurrence reports from flight ops, line stations or maintenance hangars and tracks their status.',
      },
      {
        title: 'Investigator',
        body: 'Runs investigations, RCA and evidence; raises corrective actions but cannot verify or close them alone.',
      },
      {
        title: 'Safety manager',
        body: 'Triages, assigns, verifies effectiveness and closes incidents — the only role that can seal a case (besides admin).',
      },
      {
        title: 'Compliance auditor',
        body: 'Read-only across records with export rights: inspects audit logs and produces regulator packages.',
      },
    ],
    takeaway: 'Safety culture works when the right people see the right information at the right time — and cannot see the rest.',
    visual: RolesVisual,
    screen: 'Settings · Team',
  },
  {
    id: 'platform',
    label: 'Under the hood',
    icon: Layers,
    title: 'How the platform is built',
    lede: 'A React 19 + TypeScript + Vite frontend on a strict Tailwind v4 token design system, talking to a service layer that runs on a realistic mock today and switches to a Django REST backend without touching UI code.',
    bullets: [
      {
        title: 'Design system',
        body: 'Cockpit graphite and a single brass accent, IBM Plex type, dark and light themes — every colour and size comes from tokens, so re-branding is a two-line edit.',
      },
      {
        title: 'Data layer',
        body: 'One fetch boundary with simulated latency; VITE_USE_MOCK=false points the identical hooks at /api/v1 endpoints (incidents, dashboard, RCA, CAPA, compliance…).',
      },
      {
        title: 'Honest security posture',
        body: 'The client-side PBKDF2 demo auth is clearly labelled demonstration-only; production delegates credentials, sessions and rate limits to the backend.',
      },
      {
        title: 'Try it now',
        body: '“View demo” on the landing page signs you in with demo@skyshield.aero and lands you on the live dashboard with seeded data.',
      },
    ],
    takeaway: 'Everything you have seen is the real application running on a demonstration dataset — the same code paths production would use.',
    visual: PlatformVisual,
  },
]
