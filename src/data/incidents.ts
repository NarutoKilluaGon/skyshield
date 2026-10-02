import type {
  Aircraft,
  Incident,
  IncidentCategory,
  IncidentStatus,
  Likelihood,
  Location,
  OperationalPhase,
  Severity,
} from '@/types'
import { riskLevel, riskScore } from '@/lib/domain'
import { AIRCRAFT } from './aircraft'

/* ------------------------------------------------------------------ places */

const LOC: Record<string, Location> = {
  DEL: {
    airport: 'Indira Gandhi International',
    iata: 'DEL',
    city: 'New Delhi',
    country: 'India',
    specific: 'RWY 28L, Taxiway M4',
    latitude: 28.5562,
    longitude: 77.1,
  },
  BLR: {
    airport: 'Kempegowda International',
    iata: 'BLR',
    city: 'Bengaluru',
    country: 'India',
    specific: 'RWY 09R, Rapid Exit K2',
    latitude: 13.1986,
    longitude: 77.7066,
  },
  BOM: {
    airport: 'Chhatrapati Shivaji Maharaj Intl',
    iata: 'BOM',
    city: 'Mumbai',
    country: 'India',
    specific: 'Gate 42, Apron West',
    latitude: 19.0896,
    longitude: 72.8656,
  },
  MAA: {
    airport: 'Chennai International',
    iata: 'MAA',
    city: 'Chennai',
    country: 'India',
    specific: 'Hangar 3, Line Bay',
    latitude: 12.9941,
    longitude: 80.1709,
  },
  HYD: {
    airport: 'Rajiv Gandhi International',
    iata: 'HYD',
    city: 'Hyderabad',
    country: 'India',
    specific: 'RWY 09, Alpha Taxiway',
    latitude: 17.2403,
    longitude: 78.4294,
  },
  CCU: {
    airport: 'Netaji Subhas Chandra Bose Intl',
    iata: 'CCU',
    city: 'Kolkata',
    country: 'India',
    specific: 'RWY 01, Taxiway B',
    latitude: 22.6547,
    longitude: 88.4467,
  },
  GOI: {
    airport: 'Manohar International',
    iata: 'GOI',
    city: 'Goa',
    country: 'India',
    specific: 'Stand 7, North Apron',
    latitude: 15.3808,
    longitude: 73.8314,
  },
  SIN: {
    airport: 'Singapore Changi',
    iata: 'SIN',
    city: 'Singapore',
    country: 'Singapore',
    specific: 'RWY 02L, Overhead Bay',
    latitude: 1.3644,
    longitude: 103.9915,
  },
  DXB: {
    airport: 'Dubai International',
    iata: 'DXB',
    city: 'Dubai',
    country: 'UAE',
    specific: 'Concourse A, Stand A12',
    latitude: 25.2532,
    longitude: 55.3657,
  },
}

const AC_INDEX: Record<string, Aircraft> = Object.fromEntries(
  AIRCRAFT.map((a) => [a.registration, a]),
)

const PHASE_TEXT: Record<OperationalPhase, string> = {
  gate: 'the turn-round at the gate',
  pushback: 'pushback',
  taxi: 'taxi-out',
  takeoff: 'the take-off roll',
  climb: 'the climb',
  cruise: 'cruise',
  descent: 'the descent',
  approach: 'the approach',
  landing: 'the landing',
  maintenance: 'a scheduled maintenance check',
  ground_ops: 'ground handling operations',
}

const CREW_POOL = [
  ['Capt. V. Raghavan', 'F/O S. Iyer', 'F/E M. Qureshi'],
  ['Capt. A. Bose', 'F/O D. Menon', 'F/E P. Joshi'],
  ['Capt. R. Kulkarni', 'F/O N. Farooq', 'F/E A. Ghosh'],
  ['Capt. H. Sandhu', 'F/O T. Varma', 'F/E K. Pillai'],
  ['Capt. S. Malhotra', 'F/O R. Das', 'F/E M. Fernandes'],
]

/** Reporters resolve to real user records so the detail view shows a name. */
const REPORTERS = ['usr_002', 'usr_003', 'usr_004', 'usr_005', 'usr_007', 'usr_001']

const DEPARTMENTS = [
  'Flight Operations',
  'Line Maintenance',
  'Cabin Crew',
  'Engineering',
  'Ground Handling',
  'Ramp Services',
]

/** Domestic trunk routes used to build a sensible origin/destination pair. */
const SECTORS: [string, string][] = [
  ['DEL', 'BLR'],
  ['BLR', 'DEL'],
  ['DEL', 'BOM'],
  ['BOM', 'DEL'],
  ['DEL', 'MAA'],
  ['DEL', 'HYD'],
  ['DEL', 'CCU'],
  ['GOI', 'DEL'],
  ['BLR', 'HYD'],
  ['DEL', 'GOI'],
]

/* ----------------------------------------------------------------- builder */

type Draft = {
  n: number
  date: string
  title: string
  category: IncidentCategory
  severity: Severity
  likelihood: Likelihood
  status: IncidentStatus
  reg: string
  airport: keyof typeof LOC
  flightNo?: string
  description?: string
  immediateActions?: string
  phase?: OperationalPhase
  investigatorId?: string
  reporterId?: string
  rcaId?: string
  investigationId?: string
  capaIds?: string[]
  injuries?: number
  damageCategory?: Incident['damageCategory']
  evidenceCount?: number
  riskNotes?: string
  department?: string
  confidentiality?: Incident['confidentiality']
  regulatoryNotification?: boolean
  destination?: string
}

function build(d: Draft): Incident {
  const loc = LOC[d.airport]
  const ac = AC_INDEX[d.reg]
  const ref = `P_006-${String(259 - d.n).padStart(3, '0')}`
  const score = riskScore(d.severity, d.likelihood)
  const hh = String(6 + (d.n % 14)).padStart(2, '0')
  const mm = String((d.n * 7) % 60).padStart(2, '0')
  const rh = String(9 + (d.n % 9)).padStart(2, '0')
  const rm = String((d.n * 13) % 60).padStart(2, '0')
  const flightNo = d.flightNo ?? `SKY${1200 + d.n * 3}`
  // Closure lands five days after the occurrence — real date arithmetic, so
  // month ends roll over instead of producing invalid ISO strings like 09-33.
  const closedAt = (() => {
    if (d.status !== 'closed') return undefined
    const t = new Date(`${d.date}T16:30:00Z`)
    t.setUTCDate(t.getUTCDate() + 5)
    return `${t.toISOString().slice(0, 19)}Z`
  })()
  // Pick a trunk sector that passes through the occurrence airport where possible.
  const throughPort = SECTORS.filter(([o, dst]) => o === d.airport || dst === d.airport)
  const sector = throughPort[d.n % throughPort.length] ?? SECTORS[d.n % SECTORS.length]

  return {
    id: `inc_${String(d.n).padStart(3, '0')}`,
    ref,
    occurredAt: `${d.date}T${hh}:${mm}:00Z`,
    reportedAt: `${d.date}T${rh}:${rm}:00Z`,
    closedAt,
    title: d.title,
    description:
      d.description ??
      `${d.title}. Occurred during ${PHASE_TEXT[d.phase ?? 'cruise']} at ${loc.airport} (${loc.specific}). ${ac.registration} operated as flight ${flightNo}. The event was captured by the operator Flight Data Monitoring programme and is recorded here for trend analysis.`,
    category: d.category,
    status: d.status,
    risk: {
      severity: d.severity,
      likelihood: d.likelihood,
      score,
      level: riskLevel(score),
      assessedBy: 'usr_001',
      assessedAt: `${d.date}T${rh}:${rm}:00Z`,
      notes: d.riskNotes,
    },
    aircraftId: ac.id,
    flight: {
      id: `flt_${String(d.n).padStart(3, '0')}`,
      flightNumber: flightNo,
      aircraftId: ac.id,
      // Route the flight so its origin/destination pair makes sense and the
      // occurrence airport sits on the sector it was recorded at.
      origin: d.destination ? 'DEL' : sector[0],
      destination: d.destination ?? sector[1],
      scheduledDeparture: `${d.date}T${hh}:${mm}:00Z`,
      actualDeparture: `${d.date}T${hh}:${(Number(mm) + 4) % 60}:00Z`,
      flightType: d.destination === 'DXB' ? 'charter' : 'scheduled',
      pax: 96 + ((d.n * 7) % 110),
      sector: d.destination === 'DXB' ? 'International' : 'Domestic',
    },
    location: loc,
    phase: d.phase ?? 'cruise',
    reporterId: d.reporterId ?? REPORTERS[d.n % REPORTERS.length],
    investigatorId: d.investigatorId,
    crew: CREW_POOL[d.n % CREW_POOL.length],
    department: d.department ?? DEPARTMENTS[d.n % DEPARTMENTS.length],
    operator: 'Skyline Air',
    immediateActions:
      d.immediateActions ??
      'Crew returned to base under emergency or precautionary procedures. Maintenance control notified and the aircraft placed under control pending technical inspection. No further damage to the airframe was recorded.',
    injuries: d.injuries ?? 0,
    damageCategory: d.damageCategory ?? 'none',
    investigationId: d.investigationId,
    rcaId: d.rcaId,
    capaIds: d.capaIds ?? [],
    evidenceCount: d.evidenceCount ?? ((d.n % 7) + 2),
    confidentiality: d.confidentiality ?? 'restricted',
    occurrenceCategory: d.severity === 'critical' ? 'SI' : d.status === 'closed' ? 'GI' : 'GI',
    regulatoryNotification: d.regulatoryNotification ?? false,
    notifiedAuthority: d.regulatoryNotification ? 'DGCA AAIB' : undefined,
  }
}

/* ------------------------------------------------------- headline incidents */

export const INCIDENTS: Incident[] = [
  build({
    n: 1,
    date: '2026-09-26',
    title: 'Uncommanded engine surge during cruise climb',
    description:
      'Approximately 40 minutes after take-off from Delhi, the crew observed an uncommanded thrust surge on the number 2 engine accompanied by an EGT rise of 34 °C. The crew executed the memory items, shut the engine down and continued to Bengaluru as a single-engine flight. An engine control unit chip failure is suspected on the ground.',
    immediateActions:
      'ENG-2 shut down in accordance with the QRH. Flight continued single-engine to BLR with emergency services standing by. EECU removed and quarantined for bench investigation.',
    category: 'engine_issue',
    severity: 'high',
    likelihood: 4,
    status: 'investigation',
    reg: 'VT-ALB',
    airport: 'BLR',
    flightNo: 'SKY2214',
    phase: 'climb',
    investigatorId: 'usr_002',
    investigationId: 'inv_001',
    rcaId: 'rca_001',
    capaIds: ['capa_001', 'capa_002', 'capa_005'],
    evidenceCount: 9,
    regulatoryNotification: true,
    riskNotes: 'Uncommanded thrust event with latent secondary damage potential.',
  }),
  build({
    n: 2,
    date: '2026-09-26',
    title: 'Bird strike on number 2 engine, airframe inspection required',
    description:
      'The crew reported a thump on the right hand side of the fuselage followed by an EGT indication change on the number 2 engine while climbing through 4,000 ft. Bird remains were recovered from the spoiler bay panel. The aircraft landed normally at Bengaluru and a leading edge nick was found on blade 1.',
    category: 'bird_strike',
    severity: 'medium',
    likelihood: 3,
    status: 'investigation',
    reg: 'VT-ANE',
    airport: 'BLR',
    flightNo: 'SKY3238',
    phase: 'climb',
    investigatorId: 'usr_003',
    investigationId: 'inv_002',
    rcaId: 'rca_002',
    capaIds: ['capa_003'],
    evidenceCount: 6,
    riskNotes: 'Structural integrity check pending; blade within serviceable limits.',
  }),
  build({
    n: 3,
    date: '2026-09-25',
    title: 'Runway excursion onto grass shoulder during landing',
    description:
      'During a wet runway landing at Chennai the aircraft veered right after nose-wheel touchdown. The main gear left the paved surface and came to rest on the shoulder approximately 90 m past the design touchdown zone. No serious injuries. The investigation has identified a degraded brake temperature sensor as a likely contributor.',
    immediateActions:
      'Aircraft recovered under ARFF actions with towbar and steering. Brake temperature sensor removed and tested. Aircraft returned to service after rectification.',
    category: 'runway_excursion',
    severity: 'high',
    likelihood: 3,
    status: 'rca_pending',
    reg: 'VT-ANF',
    airport: 'MAA',
    flightNo: 'SKY1866',
    phase: 'landing',
    investigatorId: 'usr_002',
    investigationId: 'inv_003',
    rcaId: 'rca_003',
    capaIds: ['capa_004', 'capa_006'],
    evidenceCount: 11,
    injuries: 2,
    damageCategory: 'substantial',
    regulatoryNotification: true,
    riskNotes: 'Excursion with ARFF involvement and elevated public interest exposure.',
  }),
  build({
    n: 4,
    date: '2026-09-24',
    title: 'Cabin smoke detector activation, galley fault suspected',
    description:
      'The aft galley smoke detector activated at approximately 38,000 ft prompting the crew to check the related fire-handling page. No smoke was found. The galley was shut down and the flight continued to Mumbai. Post-flight inspection revealed a scorched toaster element beneath the oven.',
    category: 'cabin_issue',
    severity: 'low',
    likelihood: 2,
    status: 'closed',
    reg: 'VT-ANG',
    airport: 'BOM',
    flightNo: 'SKY2210',
    phase: 'cruise',
    investigatorId: 'usr_004',
    capaIds: ['capa_007', 'capa_008'],
    evidenceCount: 4,
    riskNotes: 'Contained on board; cabin smoke remains a high-consequence event class.',
  }),
  build({
    n: 5,
    date: '2026-09-23',
    title: 'Left hydraulic system low level indication in cruise',
    description:
      'The crew received a low level caution for the left hydraulic system. The cross-system was configured and the flight continued to Hyderabad. Line maintenance traced the condition to a failed pressure transducer; no hydraulic leak was found.',
    category: 'hydraulic_failure',
    severity: 'medium',
    likelihood: 3,
    status: 'capa',
    reg: 'VT-ANJ',
    airport: 'HYD',
    flightNo: 'SKY1402',
    phase: 'cruise',
    investigatorId: 'usr_005',
    rcaId: 'rca_004',
    capaIds: ['capa_009', 'capa_010', 'capa_011'],
    evidenceCount: 7,
  }),
  build({
    n: 6,
    date: '2026-09-22',
    title: 'FMS fault, reversionary mode selected',
    description:
      'A single DCDU fault indication was observed by the crew during the climb. The FMS reverted to reversionary mode and the flight was re-planned manually. The unit was removed on arrival.',
    category: 'avionics_fault',
    severity: 'medium',
    likelihood: 2,
    status: 'investigation',
    reg: 'VT-ANL',
    airport: 'DEL',
    flightNo: 'SKY2455',
    phase: 'climb',
    investigatorId: 'usr_007',
    investigationId: 'inv_005',
    capaIds: ['capa_012'],
    evidenceCount: 5,
  }),
  build({
    n: 7,
    date: '2026-09-21',
    title: 'Fuel quantity discrepancy between gauging and uplink',
    description:
      'Pre-departure fuel reconciliation showed a 480 kg discrepancy between the gauging system and the vendor uplink figure. The load was re-verified and the flight operated with upland tanks. Uplink calibration remains under review.',
    category: 'fuel_system',
    severity: 'high',
    likelihood: 2,
    status: 'rca_pending',
    reg: 'VT-ANO',
    airport: 'GOI',
    flightNo: 'SKY0904',
    phase: 'gate',
    investigatorId: 'usr_001',
    rcaId: 'rca_005',
    capaIds: ['capa_013', 'capa_014'],
    evidenceCount: 8,
    riskNotes: 'Fuel figures are safety critical at the gate; the root cause is not yet established.',
  }),
  build({
    n: 8,
    date: '2026-09-20',
    title: 'Brake wear below limit at pre-flight inspection',
    description:
      'A pre-flight inspection found brake wear at 1.8 mm against a 2.5 mm limit. The defect was outside MEL limits so dispatch was held pending an engineering assessment and the aircraft was swapped.',
    immediateActions:
      'Dispatch held. Aircraft substituted with VT-ANL. Brake assembly sent for dimensional inspection.',
    category: 'tire_brake',
    severity: 'high',
    likelihood: 2,
    status: 'capa',
    reg: 'VT-ANJ',
    airport: 'CCU',
    flightNo: 'SKY1120',
    phase: 'maintenance',
    investigatorId: 'usr_005',
    capaIds: ['capa_015'],
    evidenceCount: 3,
  }),
  build({
    n: 9,
    date: '2026-09-19',
    title: 'Cabin altitude excursion on manual pressurisation',
    description:
      'The crew observed cabin altitude rising to 8,900 ft with the pressurisation system in manual mode. The standby controller was selected and the cabin was returned to normal. A control panel fault indication was noted.',
    immediateActions:
      'Oxygen masks checked, no deployment required. Flight continued to DEL. Panel replaced on arrival.',
    category: 'pressurisation',
    severity: 'critical',
    likelihood: 2,
    status: 'investigation',
    reg: 'VT-ANM',
    airport: 'DEL',
    flightNo: 'SKY0012',
    phase: 'cruise',
    investigatorId: 'usr_002',
    investigationId: 'inv_006',
    rcaId: 'rca_006',
    capaIds: ['capa_016', 'capa_017', 'capa_018'],
    evidenceCount: 12,
    regulatoryNotification: true,
    riskNotes: 'Hypoxia risk in a single aisle cabin; classified as a serious incident.',
  }),
  build({
    n: 10,
    date: '2026-09-18',
    title: 'Jet blast damage to GPU cable during pushback',
    description:
      'A ground power unit cable was damaged by jet blast during pushback. The GPU was repositioned and the cable replaced. No aircraft damage was sustained.',
    category: 'ground_damage',
    severity: 'low',
    likelihood: 3,
    status: 'closed',
    reg: 'VT-ALB',
    airport: 'DEL',
    flightNo: 'SKY1176',
    phase: 'pushback',
    investigatorId: 'usr_004',
    capaIds: ['capa_019'],
    evidenceCount: 2,
  }),
  build({
    n: 11,
    date: '2026-09-17',
    title: 'Near miss: unstable approach below glide path at 500 ft',
    description:
      'The aircraft was flown below the glide path on an ILS approach in IMC. A go around was initiated at approximately 220 ft when the crew recognised the deviation. Reported as a near miss and used for recurrent simulator training.',
    category: 'near_miss',
    severity: 'high',
    likelihood: 3,
    status: 'capa',
    reg: 'VT-ANE',
    airport: 'BLR',
    flightNo: 'SKY2931',
    phase: 'approach',
    investigatorId: 'usr_007',
    rcaId: 'rca_007',
    capaIds: ['capa_020', 'capa_021'],
    evidenceCount: 5,
    riskNotes: 'Approach instability in IMC is a leading contributor to controlled flight into terrain.',
  }),
  build({
    n: 12,
    date: '2026-09-16',
    title: 'Tyre sidewall damage on taxiway, FOD suspected',
    description:
      'During taxi the crew felt a vibration. Inspection revealed a sidewall cut on the number 2 main gear tyre. Foreign object debris was suspected from an adjacent construction area.',
    category: 'tire_brake',
    severity: 'medium',
    likelihood: 2,
    status: 'closed',
    reg: 'VT-ANG',
    airport: 'BOM',
    flightNo: 'SKY0668',
    phase: 'taxi',
    investigatorId: 'usr_004',
    capaIds: ['capa_022'],
    evidenceCount: 4,
  }),
  build({
    n: 13,
    date: '2026-09-15',
    title: 'Engine oil consumption above trend on number 1 engine',
    description:
      'Routine oil servicing records showed a step increase in consumption on the number 1 engine. The engine was removed for borescope and the oil was analysed in the laboratory.',
    category: 'engine_issue',
    severity: 'medium',
    likelihood: 3,
    status: 'investigation',
    reg: 'VT-ANJ',
    airport: 'MAA',
    flightNo: 'SKY1755',
    phase: 'maintenance',
    investigatorId: 'usr_005',
    investigationId: 'inv_007',
    capaIds: ['capa_023'],
    evidenceCount: 6,
  }),
  build({
    n: 14,
    date: '2026-09-14',
    title: 'Ramp vehicle incursion on stand, wingtip clearance marginal',
    description:
      'A catering high-lift vehicle approached the stand without marshaller clearance and passed within 1.2 m of the left wingtip. The marshaller called a stop. A stand clearance briefing was re-issued to all handlers.',
    category: 'ground_damage',
    severity: 'high',
    likelihood: 2,
    status: 'rca_pending',
    reg: 'VT-ANF',
    airport: 'MAA',
    flightNo: 'SKY2211',
    phase: 'gate',
    investigatorId: 'usr_001',
    rcaId: 'rca_008',
    capaIds: ['capa_024', 'capa_025'],
    evidenceCount: 7,
    riskNotes: 'Ground incursion with a credible wingtip strike outcome.',
  }),
  build({
    n: 15,
    date: '2026-09-13',
    title: 'Flight control trim run-away caution on take-off',
    description:
      'A trim run-away caution was displayed shortly after rotation. The crew cut the trim motors and continued with a modified trim profile. A faulty trim switch assembly was subsequently isolated.',
    category: 'avionics_fault',
    severity: 'critical',
    likelihood: 2,
    status: 'capa',
    reg: 'VT-ANL',
    airport: 'HYD',
    flightNo: 'SKY3012',
    phase: 'takeoff',
    investigatorId: 'usr_002',
    rcaId: 'rca_009',
    capaIds: ['capa_026', 'capa_027', 'capa_028'],
    evidenceCount: 10,
    regulatoryNotification: true,
    riskNotes: 'Take-off phase control event with potential loss of control authority.',
  }),
  build({
    n: 16,
    date: '2026-09-12',
    title: 'Aircraft struck by lightning on the ground at Delhi',
    description:
      'A ground strike was recorded on the nose radome while the aircraft was parked. The transponder and external power were unaffected and the aircraft was released after an electrical walk-around.',
    category: 'avionics_fault',
    severity: 'medium',
    likelihood: 3,
    status: 'closed',
    reg: 'VT-ANO',
    airport: 'DEL',
    flightNo: 'SKY0550',
    phase: 'gate',
    investigatorId: 'usr_004',
    capaIds: ['capa_029'],
    evidenceCount: 3,
  }),
  build({
    n: 17,
    date: '2026-09-11',
    title: 'Crew fatigue risk assessment triggered, sector extended',
    description:
      'The flight was dispatched with an extended duty period after a technical delay. A fatigue risk assessment was completed and an augmented crew was provided. Reported for trend analysis.',
    category: 'fatigue_risk',
    severity: 'medium',
    likelihood: 3,
    status: 'capa',
    reg: 'VT-ALB',
    airport: 'DEL',
    flightNo: 'SKY3340',
    phase: 'gate',
    investigatorId: 'usr_001',
    capaIds: ['capa_030', 'capa_031'],
    evidenceCount: 2,
    riskNotes: 'Duty time exceedance is a recognised precursor to human factors error.',
  }),
  build({
    n: 18,
    date: '2026-09-10',
    title: 'APU failure on stand, aircraft towed to gate',
    description:
      'The APU failed to start after a two attempt relight on the stand. The aircraft was towed and the flight operated on ground power with a subsequent schedule delay.',
    category: 'engine_issue',
    severity: 'medium',
    likelihood: 2,
    status: 'investigation',
    reg: 'VT-ANM',
    airport: 'DXB',
    flightNo: 'SKY7008',
    destination: 'DXB',
    phase: 'gate',
    investigatorId: 'usr_005',
    investigationId: 'inv_008',
    capaIds: ['capa_032'],
    evidenceCount: 5,
  }),
  build({
    n: 19,
    date: '2026-09-09',
    title: 'Wing ice accumulation indication during approach',
    description:
      'A slip indication and a brief roll oscillation were reported on approach in icing conditions. Recorded as a non-compliant practice pending review of the contamination check procedure.',
    category: 'near_miss',
    severity: 'high',
    likelihood: 2,
    status: 'rca_pending',
    reg: 'VT-ANE',
    airport: 'SIN',
    flightNo: 'SKY6042',
    phase: 'approach',
    investigatorId: 'usr_007',
    rcaId: 'rca_010',
    capaIds: ['capa_033', 'capa_034'],
    evidenceCount: 6,
    riskNotes: 'Wing contamination; contamination check cadence under review.',
  }),
  build({
    n: 20,
    date: '2026-09-08',
    title: 'Oxygen mask deployment, high altitude cabin alert',
    description:
      'Masks deployed in the forward cabin following a high altitude cabin alert. The flight descended immediately to 10,000 ft. The pack controller was found latched in the closed position.',
    immediateActions:
      'Masks reset and oxygen supply verified. Flight continued to BOM. Pack controller replaced.',
    category: 'cabin_issue',
    severity: 'critical',
    likelihood: 1,
    status: 'investigation',
    reg: 'VT-ANG',
    airport: 'BOM',
    flightNo: 'SKY4471',
    phase: 'cruise',
    investigatorId: 'usr_004',
    investigationId: 'inv_009',
    capaIds: ['capa_035', 'capa_036'],
    evidenceCount: 8,
    regulatoryNotification: true,
    riskNotes: 'Uncommanded mask deployment; emergency descent executed.',
  }),
  build({
    n: 21,
    date: '2026-09-07',
    title: 'Cowl fan blade rub indication during cruise',
    description:
      'Engine monitoring recorded a temporary cowl fan blade rub signature on engine 1. The flight was diverted to the nearest suitable airport. Fan case inspection found light rubbing only.',
    category: 'engine_issue',
    severity: 'high',
    likelihood: 2,
    status: 'capa',
    reg: 'VT-ANF',
    airport: 'CCU',
    flightNo: 'SKY1600',
    phase: 'cruise',
    investigatorId: 'usr_002',
    capaIds: ['capa_037', 'capa_038'],
    evidenceCount: 7,
  }),
  build({
    n: 22,
    date: '2026-09-06',
    title: 'Door 2 slide deferred under MEL',
    description:
      'A pre-flight check found the passenger slide indication in fault. The defect was certified under the MEL and the aircraft operated normally.',
    category: 'cabin_issue',
    severity: 'low',
    likelihood: 2,
    status: 'closed',
    reg: 'VT-ALB',
    airport: 'DEL',
    flightNo: 'SKY0990',
    phase: 'gate',
    investigatorId: 'usr_004',
    capaIds: ['capa_039'],
    evidenceCount: 2,
  }),
  build({
    n: 23,
    date: '2026-09-05',
    title: 'Rudder asymmetry on landing, control cable tension',
    description:
      'Post-flight inspection found asymmetric rudder pedal feel. No hydraulic leak was identified. The flight control cable tension was found outside the tolerance band.',
    category: 'hydraulic_failure',
    severity: 'medium',
    likelihood: 3,
    status: 'investigation',
    reg: 'VT-ANJ',
    airport: 'MAA',
    flightNo: 'SKY2190',
    phase: 'landing',
    investigatorId: 'usr_005',
    investigationId: 'inv_010',
    capaIds: ['capa_040', 'capa_041'],
    evidenceCount: 4,
  }),
  build({
    n: 24,
    date: '2026-09-04',
    title: 'FOD ingestion indication, borescope required',
    description:
      'A foreign object ingestion indication was captured on the number 1 engine during the take-off roll. The engine was borescoped and a small piece of rubber was recovered.',
    category: 'engine_issue',
    severity: 'high',
    likelihood: 2,
    status: 'rca_pending',
    reg: 'VT-ANL',
    airport: 'HYD',
    flightNo: 'SKY1122',
    phase: 'takeoff',
    investigatorId: 'usr_003',
    rcaId: 'rca_011',
    capaIds: ['capa_042', 'capa_043'],
    evidenceCount: 6,
  }),
]

/* ----------------------------------------- backfill for pagination depth */

const BACKFILL_CATS: IncidentCategory[] = [
  'bird_strike',
  'cabin_issue',
  'engine_issue',
  'ground_damage',
  'avionics_fault',
  'tire_brake',
  'near_miss',
  'fuel_system',
  'pressurisation',
  'hydraulic_failure',
]

const BACKFILL_TITLES: Record<IncidentCategory, string> = {
  engine_issue: 'Engine indication anomaly on the number {n} engine',
  bird_strike: 'Bird strike reported on {phase}',
  runway_excursion: 'Runway excursion risk event during {phase}',
  cabin_issue: 'Cabin systems indication with ground handling involvement',
  hydraulic_failure: 'Hydraulic system caution, configuration change applied',
  avionics_fault: 'Avionics fault indication, reversionary operation',
  fuel_system: 'Fuel gauging discrepancy during {phase}',
  tire_brake: 'Brake or tyre defect identified at {phase}',
  pressurisation: 'Pressurisation control fault indication',
  ground_damage: 'Ground handling damage, no flight impact',
  fatigue_risk: 'Duty time and fatigue risk monitoring trigger',
  near_miss: 'Near miss reported, no damage or injury',
}

const PORTS = Object.keys(LOC) as (keyof typeof LOC)[]

const STATUS_CYCLE: IncidentStatus[] = [
  'closed',
  'capa',
  'investigation',
  'rca_pending',
  'closed',
  'reported',
  'closed',
  'capa',
  'investigation',
  'closed',
]

for (let i = 0; i < 56; i++) {
  const n = 25 + i
  const dayOffset = 3 - Math.floor(i / 2.2)
  const day = dayOffset > 0 ? dayOffset : 28 + dayOffset
  const month = dayOffset > 0 ? '09' : '08'
  const cat = BACKFILL_CATS[i % BACKFILL_CATS.length]
  const status = STATUS_CYCLE[i % STATUS_CYCLE.length]
  const sev: Severity =
    status === 'closed'
      ? (['low', 'medium', 'medium', 'low', 'negligible'] as Severity[])[i % 5]
      : (['medium', 'high', 'medium', 'critical', 'low', 'high'] as Severity[])[i % 6]
  const lik = ([2, 3, 2, 3, 1, 2, 3, 4] as Likelihood[])[i % 8]
  const port = PORTS[i % PORTS.length]
  const reg = AIRCRAFT[i % AIRCRAFT.length].registration
  const phase = (['cruise', 'climb', 'gate', 'taxi', 'landing', 'maintenance', 'approach'] as OperationalPhase[])[i % 7]

  INCIDENTS.push(
    build({
      n,
      date: `2026-${month}-${String(day).padStart(2, '0')}`,
      title: BACKFILL_TITLES[cat]
        .replace('{n}', String((i % 2) + 1))
        .replace('{phase}', PHASE_TEXT[phase].replace('the ', '')),
      category: cat,
      severity: sev,
      likelihood: lik,
      status,
      reg,
      airport: port,
      phase,
      flightNo: `SKY${1000 + ((i * 37) % 8000)}`,
      investigatorId: ['usr_002', 'usr_003', 'usr_004', 'usr_005', 'usr_007'][i % 5],
      capaIds: status === 'capa' || status === 'closed' ? [`capa_${String(((i * 7) % 43) + 1).padStart(3, '0')}`] : [],
      evidenceCount: (i % 9) + 1,
      confidentiality: i % 11 === 0 ? 'open' : i % 4 === 0 ? 'internal' : 'restricted',
    }),
  )
}

INCIDENTS.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))

export const incidentById = (id?: string | null): Incident | undefined =>
  id ? INCIDENTS.find((i) => i.id === id || i.ref === id) : undefined

export const AIRPORTS = Object.values(LOC).map((l) => ({ iata: l.iata, label: `${l.iata} — ${l.city}` }))
