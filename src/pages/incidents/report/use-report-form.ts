import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  EvidenceItem,
  Incident,
  IncidentCategory,
  Likelihood,
  OperationalPhase,
  Severity,
} from '@/types'
import { createIncident } from '@/services/incidents'
import { kindOfFile, registerEvidenceLocal, uploadEvidence } from '@/services/operations'
import { sha256Hex } from '@/lib/hash'
import { AIRCRAFT } from '@/data/aircraft'
import { SEVERITY_VALUE, riskBand, riskLevel } from '@/lib/domain'
import { isFlightNo, VALIDATION_MESSAGES } from '@/lib/validation'

/* ------------------------------------------------------------------ steps */

export const STEPS = [
  { id: 1, label: 'Basic Information', hint: 'When, where and which aircraft' },
  { id: 2, label: 'Incident Classification', hint: 'Type, severity and likelihood' },
  { id: 3, label: 'Description', hint: 'Narrative of what happened' },
  { id: 4, label: 'People / Organisations', hint: 'Reporter, crew and department' },
  { id: 5, label: 'Evidence', hint: 'Photos, documents and data' },
  { id: 6, label: 'Immediate Actions', hint: 'Containment taken on the day' },
  { id: 7, label: 'Review & Submit', hint: 'Verify and file the record' },
] as const

export const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.mp4,.mov,.txt'

/* ------------------------------------------------------------------- form */

export interface FormState {
  occurredDate: string
  occurredTime: string
  location: string
  airport: string
  flightNumber: string
  aircraftReg: string
  aircraftType: string
  category: IncidentCategory | ''
  severity: Severity | ''
  likelihood: Likelihood
  phase: OperationalPhase
  description: string
  reporterId: string
  crew: string
  department: string
  operator: string
  immediateActions: string
  injuries: number
  regulatory: boolean
  confidential: 'internal' | 'restricted' | 'open'
}

export const EMPTY: FormState = {
  occurredDate: new Date().toISOString().slice(0, 10),
  occurredTime: new Date().toTimeString().slice(0, 5),
  location: '',
  airport: 'DEL',
  flightNumber: '',
  aircraftReg: '',
  aircraftType: '',
  category: '',
  severity: '',
  likelihood: 3,
  phase: 'cruise',
  description: '',
  reporterId: 'usr_001',
  crew: '',
  department: 'Flight Operations',
  operator: 'Skyline Air',
  immediateActions: '',
  injuries: 0,
  regulatory: false,
  confidential: 'restricted',
}

/** Fields each guided step owns — the step is valid when these are clean. */
export const STEP_FIELDS: (keyof FormState)[][] = [
  ['occurredDate', 'occurredTime', 'airport', 'aircraftReg', 'flightNumber'],
  ['category', 'severity'],
  ['description'],
  ['reporterId'],
  [],
  ['immediateActions'],
  [],
]

/** Quick report requires the essentials only; the rest is completed later. */
export const QUICK_FIELDS: (keyof FormState)[] = [
  'occurredDate',
  'occurredTime',
  'airport',
  'aircraftReg',
  'flightNumber',
  'category',
  'severity',
  'description',
]

/**
 * The exact `createIncident` payload for the current form — shared by the
 * online submit path and the offline queue so both file identical records.
 */
export function buildIncidentPayload(
  form: FormState,
  evidenceCount: number,
  userId?: string,
): Partial<Incident> {
  const severityValue = form.severity ? SEVERITY_VALUE[form.severity] : 0
  const score = severityValue * form.likelihood
  return {
    title: form.description.slice(0, 90),
    description: form.description,
    category: form.category as IncidentCategory,
    risk: {
      severity: form.severity as Severity,
      likelihood: form.likelihood,
      score,
      level: riskLevel(score || 1),
      assessedBy: userId ?? 'usr_001',
      assessedAt: new Date().toISOString(),
    },
    status: 'reported',
    phase: form.phase,
    aircraftId: AIRCRAFT.find((a) => a.registration === form.aircraftReg)?.id ?? 'ac_001',
    reporterId: form.reporterId || userId || 'usr_001',
    crew: form.crew ? form.crew.split(',').map((c) => c.trim()) : [],
    department: form.department,
    operator: form.operator,
    immediateActions: form.immediateActions,
    injuries: form.injuries,
    evidenceCount,
    confidentiality: form.confidential,
    regulatoryNotification: form.regulatory,
    occurrenceCategory: form.severity === 'critical' ? 'SI' : 'GI',
  }
}

/* ------------------------------------------------------------------ draft */

export const DRAFT_KEY = 'skyshield.report.draft.v1'
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

export type ReportMode = 'quick' | 'guided'

interface ReportDraft {
  form: FormState
  evidence: EvidenceItem[]
  step: number
  mode: ReportMode
  savedAt: string
}

function readDraft(): ReportDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReportDraft
    if (!parsed?.form || typeof parsed.form !== 'object') return null
    if (Date.now() - new Date(parsed.savedAt).getTime() > DRAFT_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------- hook */

/**
 * All report-wizard state: values, touched map, full validation, per-step
 * validity, live risk maths, evidence list, debounced autosave with restore,
 * and submission. Both the quick form and the guided wizard drive this one
 * hook, so switching modes never loses data.
 */
export function useReportForm(userId: string | undefined, modeOverride?: ReportMode) {
  const draft = useMemo(readDraft, [])

  const [mode, setMode] = useState<ReportMode>(modeOverride ?? draft?.mode ?? 'quick')
  const [step, setStep] = useState(draft?.step ?? 1)
  const [form, setForm] = useState<FormState>(() =>
    draft ? { ...EMPTY, ...draft.form } : { ...EMPTY, reporterId: userId ?? 'usr_001' },
  )
  const [evidence, setEvidence] = useState<EvidenceItem[]>(draft?.evidence ?? [])
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [dirty, setDirty] = useState(!!draft)
  const [restoredAt, setRestoredAt] = useState<string | null>(draft?.savedAt ?? null)
  const [savedAt, setSavedAt] = useState<string | null>(draft?.savedAt ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ id: string; ref: string } | null>(null)

  // Adopt the signed-in reporter once auth resolves (never over a restored draft).
  useEffect(() => {
    if (userId && !draft)
      setForm((f) => (f.reporterId === 'usr_001' ? { ...f, reporterId: userId } : f))
  }, [userId, draft])

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setTouched((t) => ({ ...t, [k as string]: true }))
    setDirty(true)
  }, [])

  /** Registration select also auto-fills the type from the fleet register. */
  const onReg = useCallback((reg: string) => {
    const ac = AIRCRAFT.find((a) => a.registration === reg)
    setForm((f) => ({ ...f, aircraftReg: reg, aircraftType: ac?.type ?? f.aircraftType }))
    setTouched((t) => ({ ...t, aircraftReg: true }))
    setDirty(true)
  }, [])

  /* ------------------------------------------------------- validation */

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.occurredDate) e.occurredDate = 'Date of occurrence is required.'
    if (!form.occurredTime) e.occurredTime = 'Time of occurrence is required.'
    if (!form.airport) e.airport = 'Select the reporting airport.'
    if (!form.aircraftReg) e.aircraftReg = 'Aircraft registration is required.'
    if (form.flightNumber && !isFlightNo(form.flightNumber))
      e.flightNumber = VALIDATION_MESSAGES.flightNo
    if (!form.category) e.category = 'Select an incident type.'
    if (!form.severity) e.severity = 'Severity assessment is required.'
    if (form.description.trim().length < 40)
      e.description = 'Provide at least 40 characters so the record is actionable.'
    if (!form.reporterId) e.reporterId = 'Reporter is required.'
    if (form.immediateActions.trim().length < 20)
      e.immediateActions = 'Record the containment actions taken.'
    return e
  }, [form])

  const stepErrors = useCallback(
    (s: number) =>
      STEP_FIELDS[s - 1].filter((f) => errors[f]).map((f) => ({ field: f, message: errors[f]! })),
    [errors],
  )
  const stepValid = stepErrors(step).length === 0
  const quickErrors = useMemo(
    () => QUICK_FIELDS.filter((f) => errors[f]).map((f) => ({ field: f, message: errors[f]! })),
    [errors],
  )

  /* ----------------------------------------------------------- risk maths */

  const severityValue = form.severity ? SEVERITY_VALUE[form.severity] : 0
  const score = severityValue * form.likelihood
  const band = riskBand(score || 1)

  /* ---------------------------------------------------------- evidence */

  /**
   * The live File objects behind the evidence list, keyed by item id (M4).
   * Files are not serialisable, so a restored draft keeps its metadata but
   * loses its bytes — those items register as metadata-only.
   */
  const filesRef = useRef(new Map<string, File>())

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      const items: EvidenceItem[] = Array.from(files).map((file, i) => {
        const id = `ev_new_${Date.now()}_${i}`
        filesRef.current.set(id, file)
        return {
          id,
          name: file.name,
          kind: kindOfFile(file),
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
          uploadedBy: userId ?? 'usr_001',
          uploadedAt: new Date().toISOString(),
          hash: '',
          verified: false,
        }
      })
      setEvidence((e) => [...e, ...items])
      setDirty(true)
      // Real SHA-256 in the browser — the same digest the server registers
      // at upload, so the chain-of-custody hash shown here is the real one.
      for (const item of items) {
        const file = filesRef.current.get(item.id)
        if (!file) continue
        void sha256Hex(file).then((hash) => {
          setEvidence((e) => e.map((x) => (x.id === item.id ? { ...x, hash } : x)))
        })
      }
    },
    [userId],
  )

  const removeEvidence = useCallback((id: string) => {
    filesRef.current.delete(id)
    setEvidence((e) => e.filter((x) => x.id !== id))
    setDirty(true)
  }, [])

  /* ---------------------------------------------------------- autosave */

  const draftRef = useRef({ form, evidence, step, mode })
  draftRef.current = { form, evidence, step, mode }

  useEffect(() => {
    if (!dirty || submitted) return
    const t = window.setTimeout(() => {
      try {
        const now = new Date().toISOString()
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ ...draftRef.current, savedAt: now } satisfies ReportDraft),
        )
        setSavedAt(now)
      } catch {
        /* storage unavailable — autosave silently degrades */
      }
    }, 800)
    return () => window.clearTimeout(t)
  }, [form, evidence, step, mode, dirty, submitted])

  const discardDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
    setForm({ ...EMPTY, reporterId: userId ?? 'usr_001' })
    setEvidence([])
    setStep(1)
    setTouched({})
    setDirty(false)
    setRestoredAt(null)
    setSavedAt(null)
  }, [userId])

  const dismissRestoreNote = useCallback(() => setRestoredAt(null), [])

  /* ---------------------------------------------------------- submit */

  /**
   * M5: one stable Idempotency-Key per wizard session — if the POST times out
   * after the server filed it, a retry replays the stored answer instead of
   * creating a duplicate occurrence.
   */
  const submitKeyRef = useRef(crypto.randomUUID())

  const submit = useCallback(async () => {
    setSubmitting(true)
    try {
      // evidenceCount stays 0 at create time: the registrations below own the
      // count (server increments per upload; mock writes through the store).
      const created = await createIncident(buildIncidentPayload(form, 0, userId), {
        idempotencyKey: submitKeyRef.current,
      })
      // M4: the record exists — register the real evidence bytes against it.
      for (const ev of evidence) {
        const file = filesRef.current.get(ev.id)
        if (file) await uploadEvidence(created.id, file, ev.uploadedBy)
      }
      // Draft-restored items lost their bytes; the mock registry keeps their
      // metadata (network mode honestly registers only real uploads).
      registerEvidenceLocal(
        created.id,
        evidence.filter((ev) => !filesRef.current.has(ev.id)),
      )
      try {
        window.localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      filesRef.current.clear()
      submitKeyRef.current = crypto.randomUUID()
      setDirty(false)
      setSubmitted({ id: created.id, ref: created.ref })
    } finally {
      setSubmitting(false)
    }
  }, [form, evidence, userId])

  const markStepTouched = useCallback((s: number) => {
    setTouched((t) => {
      const next = { ...t }
      for (const f of STEP_FIELDS[s - 1]) next[f] = true
      return next
    })
  }, [])

  return {
    // state
    mode,
    setMode,
    step,
    setStep,
    form,
    set,
    onReg,
    touched,
    evidence,
    addFiles,
    removeEvidence,
    submitting,
    submitted,
    dirty,
    restoredAt,
    savedAt,
    dismissRestoreNote,
    discardDraft,
    // derived
    errors,
    stepErrors,
    stepValid,
    quickErrors,
    score,
    band,
    severityValue,
    // actions
    submit,
    markStepTouched,
  }
}

export type ReportForm = ReturnType<typeof useReportForm>
