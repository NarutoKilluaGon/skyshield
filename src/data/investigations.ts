import type { EvidenceItem, Investigation, TimelineEvent } from '@/types'

export const INVESTIGATIONS: Investigation[] = [
  {
    id: 'inv_001',
    incidentId: 'inc_001',
    name: 'Engine Failure Investigation',
    stage: 'evidence_collection',
    progress: 72,
    leadInvestigatorId: 'usr_002',
    teamMemberIds: ['usr_003', 'usr_005', 'usr_006'],
    openedAt: '2026-09-26T14:10:00Z',
    dueAt: '2026-10-08T00:00:00Z',
    priority: 'critical',
    stageHistory: [
      { stage: 'incident_reported', at: '2026-09-26T15:20:00Z', by: 'usr_001', note: 'Occurrence logged and triaged.' },
      { stage: 'initial_assessment', at: '2026-09-26T18:40:00Z', by: 'usr_001', note: 'Risk graded HIGH (16). DGCA notified.' },
      { stage: 'investigation', at: '2026-09-27T09:05:00Z', by: 'usr_002', note: 'Investigation team constituted.' },
      { stage: 'evidence_collection', at: '2026-09-28T07:30:00Z', by: 'usr_002', note: 'EECU bench test and FDM download requested.' },
    ],
    findings: [
      'ECU firmware build 4.2.1 exhibits a known open defect in the fuel-metering trim path.',
      'Airframe recorder data shows a 0.4 s thrust overshoot before the crew intervened.',
    ],
    interviews: [
      {
        name: 'Capt. V. Raghavan',
        role: 'Commander, SKY2214',
        at: '2026-09-27T11:00:00Z',
        summary: 'Described an abrupt thrust change with no control input. Response was immediate and per QRH.',
      },
      {
        name: 'M. Qureshi',
        role: 'Flight Engineer',
        at: '2026-09-27T13:30:00Z',
        summary: 'Confirmed no abnormal start or bleed configuration at the time of the event.',
      },
    ],
    openQuestions: [
      'Why was build 4.2.1 fitted to a fleet with an open defect bulletin?',
      'Has the same event occurred on other operators of this engine type?',
    ],
  },
  {
    id: 'inv_002',
    incidentId: 'inc_002',
    name: 'Bird Strike Investigation',
    stage: 'root_cause_analysis',
    progress: 54,
    leadInvestigatorId: 'usr_003',
    teamMemberIds: ['usr_004'],
    openedAt: '2026-09-26T16:00:00Z',
    dueAt: '2026-10-04T00:00:00Z',
    priority: 'high',
    stageHistory: [
      { stage: 'incident_reported', at: '2026-09-26T16:20:00Z', by: 'usr_001' },
      { stage: 'initial_assessment', at: '2026-09-26T17:10:00Z', by: 'usr_001', note: 'Risk graded MODERATE (9).' },
      { stage: 'investigation', at: '2026-09-27T08:00:00Z', by: 'usr_003' },
      { stage: 'evidence_collection', at: '2026-09-27T12:00:00Z', by: 'usr_003', note: 'Blade NDT complete; remains identified as Ploceus.' },
      { stage: 'root_cause_analysis', at: '2026-09-28T06:45:00Z', by: 'usr_003' },
    ],
    findings: [
      'Leading edge nick of 3.2 mm, within the serviceable limit for the blade profile.',
      'Strike altitude 4,000 ft corresponds to a high-density flocking period at the departure end of RWY 09R.',
    ],
    interviews: [],
    openQuestions: [
      'Should departure-end flock dispersal be increased for the morning departure bank?',
    ],
  },
  {
    id: 'inv_003',
    incidentId: 'inc_003',
    name: 'Runway Excursion Investigation',
    stage: 'root_cause_analysis',
    progress: 86,
    leadInvestigatorId: 'usr_002',
    teamMemberIds: ['usr_003', 'usr_005', 'usr_006'],
    openedAt: '2026-09-25T12:00:00Z',
    dueAt: '2026-10-02T00:00:00Z',
    priority: 'critical',
    stageHistory: [
      { stage: 'incident_reported', at: '2026-09-25T12:40:00Z', by: 'usr_001', note: 'Occurrence escalated to SI.' },
      { stage: 'initial_assessment', at: '2026-09-25T14:00:00Z', by: 'usr_001', note: 'Risk HIGH (15). AAIB notified.' },
      { stage: 'investigation', at: '2026-09-25T18:00:00Z', by: 'usr_002' },
      { stage: 'evidence_collection', at: '2026-09-26T07:30:00Z', by: 'usr_003', note: 'QAR data, FDR download, ARFF report, ATC transcript.' },
      { stage: 'root_cause_analysis', at: '2026-09-27T10:00:00Z', by: 'usr_002', note: '5 Whys draft complete.' },
    ],
    findings: [
      'Right brake temperature sensor resistance drift of 18% above the acceptable band.',
      'Anti-skid reversion was commanded 2.1 s after touchdown as designed.',
      'Landing was conducted on a wet runway 90 m into the touchdown zone with a 10 kt tailwind component.',
    ],
    interviews: [
      {
        name: 'Capt. A. Bose',
        role: 'Commander, SKY1866',
        at: '2026-09-26T10:00:00Z',
        summary: 'Reported asymmetric deceleration and a right yaw tendency immediately after touchdown.',
      },
    ],
    openQuestions: [
      'Why did the sensor drift pass the functional check?',
      'Is the functional check interval appropriate for this part number?',
    ],
  },
  {
    id: 'inv_005',
    incidentId: 'inc_006',
    name: 'FMS Reversionary Mode Investigation',
    stage: 'investigation',
    progress: 38,
    leadInvestigatorId: 'usr_007',
    teamMemberIds: ['usr_005'],
    openedAt: '2026-09-22T11:00:00Z',
    dueAt: '2026-10-12T00:00:00Z',
    priority: 'medium',
    stageHistory: [
      { stage: 'incident_reported', at: '2026-09-22T11:30:00Z', by: 'usr_001' },
      { stage: 'initial_assessment', at: '2026-09-22T13:00:00Z', by: 'usr_001', note: 'Risk MODERATE (6).' },
      { stage: 'investigation', at: '2026-09-23T09:00:00Z', by: 'usr_007' },
    ],
    findings: ['DCDU fault log shows a single non-recurring fault frame on channel 2.'],
    interviews: [],
    openQuestions: ['Is the connector pin retention within specification?'],
  },
  {
    id: 'inv_006',
    incidentId: 'inc_009',
    name: 'Cabin Pressure Investigation',
    stage: 'evidence_collection',
    progress: 63,
    leadInvestigatorId: 'usr_002',
    teamMemberIds: ['usr_004', 'usr_005'],
    openedAt: '2026-09-19T14:00:00Z',
    dueAt: '2026-10-06T00:00:00Z',
    priority: 'critical',
    stageHistory: [
      { stage: 'incident_reported', at: '2026-09-19T14:20:00Z', by: 'usr_001', note: 'Escalated to serious incident.' },
      { stage: 'initial_assessment', at: '2026-09-19T15:30:00Z', by: 'usr_001', note: 'Risk CRITICAL (10 on likelihood 2, severity 5).' },
      { stage: 'investigation', at: '2026-09-20T08:00:00Z', by: 'usr_002' },
      { stage: 'evidence_collection', at: '2026-09-21T07:00:00Z', by: 'usr_005', note: 'Pack controller bench test; control panel harness.' },
    ],
    findings: [
      'Outflow valve actuator exhibited intermittent position feedback loss.',
      'Cabin altitude reached 8,900 ft; oxygen supply remained available throughout.',
    ],
    interviews: [
      {
        name: 'F/O S. Iyer',
        role: 'First Officer, SKY0012',
        at: '2026-09-20T12:00:00Z',
        summary: 'Stated the standby controller engaged without an intervening crew selection.',
      },
    ],
    openQuestions: [
      'Does the pack controller self-test cover the outflow valve feedback path?',
    ],
  },
  {
    id: 'inv_007',
    incidentId: 'inc_013',
    name: 'Oil Consumption Trend Investigation',
    stage: 'initial_assessment',
    progress: 24,
    leadInvestigatorId: 'usr_005',
    teamMemberIds: [],
    openedAt: '2026-09-15T10:00:00Z',
    dueAt: '2026-10-20T00:00:00Z',
    priority: 'medium',
    stageHistory: [
      { stage: 'incident_reported', at: '2026-09-15T10:30:00Z', by: 'usr_001' },
      { stage: 'initial_assessment', at: '2026-09-16T08:00:00Z', by: 'usr_005' },
    ],
    findings: ['Laboratory analysis shows metallic content within limits; no wear debris signature yet.'],
    interviews: [],
    openQuestions: ['Is the servicing interval adequate given the observed step change?'],
  },
  {
    id: 'inv_008',
    incidentId: 'inc_018',
    name: 'APU Start Failure Investigation',
    stage: 'investigation',
    progress: 31,
    leadInvestigatorId: 'usr_005',
    teamMemberIds: [],
    openedAt: '2026-09-10T09:00:00Z',
    dueAt: '2026-10-18T00:00:00Z',
    priority: 'low',
    stageHistory: [
      { stage: 'incident_reported', at: '2026-09-10T09:20:00Z', by: 'usr_001' },
      { stage: 'initial_assessment', at: '2026-09-10T11:00:00Z', by: 'usr_001' },
      { stage: 'investigation', at: '2026-09-11T08:00:00Z', by: 'usr_005' },
    ],
    findings: ['Bleed air supply pressure marginal at the start valve during the second attempt.'],
    interviews: [],
    openQuestions: [],
  },
  {
    id: 'inv_009',
    incidentId: 'inc_020',
    name: 'Mask Deployment Investigation',
    stage: 'investigation',
    progress: 44,
    leadInvestigatorId: 'usr_004',
    teamMemberIds: ['usr_002'],
    openedAt: '2026-09-08T16:00:00Z',
    dueAt: '2026-10-10T00:00:00Z',
    priority: 'critical',
    stageHistory: [
      { stage: 'incident_reported', at: '2026-09-08T16:15:00Z', by: 'usr_001', note: 'AAIB notified within 1 hour.' },
      { stage: 'initial_assessment', at: '2026-09-08T17:00:00Z', by: 'usr_001' },
      { stage: 'investigation', at: '2026-09-09T07:30:00Z', by: 'usr_004' },
    ],
    findings: ['Pack controller latch mechanism remained engaged from a previous maintenance action.'],
    interviews: [],
    openQuestions: [
      'Was the maintenance action correctly recorded against the pack controller?',
    ],
  },
  {
    id: 'inv_010',
    incidentId: 'inc_023',
    name: 'Rudder Feel Discrepancy Investigation',
    stage: 'initial_assessment',
    progress: 19,
    leadInvestigatorId: 'usr_005',
    teamMemberIds: [],
    openedAt: '2026-09-05T08:00:00Z',
    dueAt: '2026-10-25T00:00:00Z',
    priority: 'medium',
    stageHistory: [
      { stage: 'incident_reported', at: '2026-09-05T08:30:00Z', by: 'usr_001' },
      { stage: 'initial_assessment', at: '2026-09-06T07:00:00Z', by: 'usr_005' },
    ],
    findings: ['Right cable tension measured 118 N against a tolerance of 95–105 N.'],
    interviews: [],
    openQuestions: [],
  },
]

export const investigationById = (id?: string | null): Investigation | undefined =>
  id ? INVESTIGATIONS.find((i) => i.id === id) : undefined

export const investigationByIncident = (incidentId: string): Investigation | undefined =>
  INVESTIGATIONS.find((i) => i.incidentId === incidentId)

/* ---------------------------------------------------------------- evidence */

export const EVIDENCE: Record<string, EvidenceItem[]> = {
  inc_001: [
    { id: 'ev_01', name: 'QAR-2214_Event_Report.pdf', kind: 'pdf', sizeKb: 1840, uploadedBy: 'usr_003', uploadedAt: '2026-09-27T06:40:00Z', hash: '9f2c…4ad1', verified: true },
    { id: 'ev_02', name: 'FDM_Engine1_ThrustTrace.csv', kind: 'log', sizeKb: 6420, uploadedBy: 'usr_002', uploadedAt: '2026-09-27T07:05:00Z', hash: '11b8…7ce0', verified: true },
    { id: 'ev_03', name: 'EECU_Bench_Test_Report.pdf', kind: 'pdf', sizeKb: 2310, uploadedBy: 'usr_005', uploadedAt: '2026-09-28T07:20:00Z', hash: '77c0…9a12', verified: false },
    { id: 'ev_04', name: 'ECU_Firmware_Build_Notes.docx', kind: 'document', sizeKb: 218, uploadedBy: 'usr_002', uploadedAt: '2026-09-27T09:10:00Z', hash: '3a4d…1f88', verified: true },
    { id: 'ev_05', name: 'Cockpit_Photo_ThrustGauge.jpg', kind: 'image', sizeKb: 3260, uploadedBy: 'usr_003', uploadedAt: '2026-09-27T08:00:00Z', hash: 'e581…0b3f', verified: true },
  ],
  inc_003: [
    { id: 'ev_11', name: 'QAR_1866_LandingRun.pdf', kind: 'pdf', sizeKb: 1960, uploadedBy: 'usr_003', uploadedAt: '2026-09-26T07:10:00Z', hash: 'aa31…77c9', verified: true },
    { id: 'ev_12', name: 'ARFF_Incident_Report.pdf', kind: 'pdf', sizeKb: 880, uploadedBy: 'usr_001', uploadedAt: '2026-09-25T18:40:00Z', hash: '2b7e…4410', verified: true },
    { id: 'ev_13', name: 'BrakeTempSensor_TestSheet.pdf', kind: 'pdf', sizeKb: 640, uploadedBy: 'usr_005', uploadedAt: '2026-09-26T09:00:00Z', hash: 'c910…8de2', verified: true },
    { id: 'ev_14', name: 'ATCB_SurfaceReport.pdf', kind: 'document', sizeKb: 1502, uploadedBy: 'usr_003', uploadedAt: '2026-09-26T11:30:00Z', hash: '4d22…be71', verified: true },
  ],
  inc_009: [
    { id: 'ev_21', name: 'PackController_BenchData.csv', kind: 'log', sizeKb: 3320, uploadedBy: 'usr_005', uploadedAt: '2026-09-21T07:40:00Z', hash: '6f03…2b19', verified: true },
    { id: 'ev_22', name: 'CabinAltitude_Trace.png', kind: 'image', sizeKb: 410, uploadedBy: 'usr_002', uploadedAt: '2026-09-20T08:10:00Z', hash: '9014…c3a8', verified: true },
  ],
}

/* ---------------------------------------------------------------- timeline */

export const TIMELINE: Record<string, TimelineEvent[]> = {
  inc_001: [
    { id: 'tl_01', at: '2026-09-26T09:58:00Z', actor: 'Capt. V. Raghavan', title: 'Occurrence reported', detail: 'Crew reported uncommanded thrust surge on ENG-2 via SATCOM and voice.', kind: 'report' },
    { id: 'tl_02', at: '2026-09-26T11:20:00Z', actor: 'A. Sharma', title: 'Investigation opened', detail: 'Formal investigation opened. Aircraft quarantined pending technical inspection.', kind: 'assignment' },
    { id: 'tl_03', at: '2026-09-26T14:10:00Z', actor: 'J. Miller', title: 'Risk assessed — HIGH (16)', detail: 'Severity HIGH, likelihood 4. Risk score 16. Escalated to serious incident class.', kind: 'rca' },
    { id: 'tl_04', at: '2026-09-26T15:05:00Z', actor: 'System', title: 'Regulatory notification sent', detail: 'AAIB notification dispatched to DGCA. Reference AAIB/2026/SI/118.', kind: 'system' },
    { id: 'tl_05', at: '2026-09-26T18:40:00Z', actor: 'A. Sharma', title: 'Status set to Investigation', detail: 'Investigation stage advanced from initial assessment.', kind: 'status' },
    { id: 'tl_06', at: '2026-09-27T06:15:00Z', actor: 'R. Singh', title: 'QAR data uploaded', detail: 'Event report and FDM thrust trace attached to the investigation file.', kind: 'evidence' },
    { id: 'tl_07', at: '2026-09-27T13:30:00Z', actor: 'M. Qureshi', title: 'Flight engineer interview recorded', detail: 'Statement captured regarding engine configuration at the time of the event.', kind: 'note' },
    { id: 'tl_08', at: '2026-09-28T07:20:00Z', actor: 'K. Nair', title: 'EECU bench test complete', detail: 'Bench report uploaded. Firmware build 4.2.1 identified with an open defect.', kind: 'evidence' },
  ],
  inc_003: [
    { id: 'tl_11', at: '2026-09-25T10:41:00Z', actor: 'Capt. A. Bose', title: 'Occurrence reported', detail: 'Crew reported departure from the runway surface during landing.', kind: 'report' },
    { id: 'tl_12', at: '2026-09-25T12:00:00Z', actor: 'J. Miller', title: 'Investigation opened', detail: 'Investigation opened. ARFF, ATC and airport records requested.', kind: 'assignment' },
    { id: 'tl_13', at: '2026-09-25T14:00:00Z', actor: 'J. Miller', title: 'Risk assessed — HIGH (15)', detail: 'Severity HIGH, likelihood 3. Risk score 15.', kind: 'rca' },
    { id: 'tl_14', at: '2026-09-26T07:30:00Z', actor: 'A. Sharma', title: 'Evidence collection started', detail: 'QAR data, FDR download, ARFF report and ATC transcript collected.', kind: 'evidence' },
    { id: 'tl_15', at: '2026-09-27T10:00:00Z', actor: 'A. Sharma', title: '5 Whys draft completed', detail: 'Causal chain identified: sensor drift → undetected by functional check → interval not risk-based.', kind: 'rca' },
    { id: 'tl_16', at: '2026-09-27T16:20:00Z', actor: 'K. Nair', title: 'Corrective actions raised', detail: '3 CAPAs raised covering sensor replacement, test interval change and crew briefing.', kind: 'capa' },
  ],
}
