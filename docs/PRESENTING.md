# Presenting SkyShield

A short runbook for demoing the platform to an audience — what to click, what
to say, and in which order. Everything below runs offline on a laptop.

## 1. Start the app

```bash
npm install          # once
npm run dev          # → http://localhost:5173
```

Node ≥ 22.12 is required for the test harness (`npm run verify`); the dev
server and build also run on Node 20+.

## 2. Open with the guided tour (2–4 minutes)

On the landing page, click **How it works** — it sits in the top nav, next to
"Get started" in the hero, at the end of the workflow section, in the closing
CTA and in the footer. Any of them opens the same full-screen, ten-chapter
tour.

Tour controls:

| Action | How |
| --- | --- |
| Next / back chapter | `Next` / `Back` buttons, or `→` / `←` keys |
| Jump to a chapter | click it in the left rail (desktop) or the chip row (mobile) |
| Hands-free slideshow | `Autoplay` (or `Space`) — 9 s per chapter, stops at the end |
| Restart / close | `Restart` on the last chapter · `Esc` or `×` |
| Go live | last chapter's **Explore the live demo** signs in and lands on the dashboard |

The ten chapters, and the one-liner for each (each chapter also shows its own
"In one sentence" takeaway you can simply read aloud):

1. **The big picture** — one register, one workflow, one source of truth: a
   report is only finished when a verified corrective action closes it.
2. **Report** — the seven-step wizard structures what/where/when/who, scores
   risk live, takes evidence, and an anonymous channel exists for confidential
   reports.
3. **Assess** — the safety manager grades severity × likelihood on the ICAO
   5×5 matrix; the band decides SLAs and regulator-notification flags.
4. **Investigate** — eight tabs in one record: timeline reconstruction,
   evidence chain, status transitions with guards.
5. **Analyse** — the editable 5 Whys chain walks from symptom to root cause;
   factors are classified human/technical/environmental/organisational/procedural.
6. **Act** — every CAPA has an owner, a due date and an SLA countdown;
   completion needs evidence, and a safety manager verifies effectiveness.
7. **Verify & close** — closure is blocked while CAPAs are open; the
   tamper-evident audit trail exports as a regulator-ready package.
8. **Insights** — dashboard, analytics, compliance and notifications all read
   the same register; nothing on the landing page is hard-coded.
9. **Roles** — five roles with a real permission matrix (the tour shows the
   same grid the app enforces).
10. **Under the hood** — React 19 + Tailwind v4 token design system; the
    service layer runs on a realistic mock and flips to Django REST with one
    env var; demo auth is clearly labelled demo-only.

## 3. Continue in the live app (optional, 3–5 minutes)

Demo account: `demo@skyshield.aero` / `demo1234` (the hero's **View demo**
button signs in automatically).

Suggested walk:

1. **Dashboard** — start at "Needs attention": the critical runway excursion
   and the overdue CAPA. Click a risk-matrix cell to see the register filter.
2. **Report incident** — walk two wizard steps to show live risk scoring and
   the evidence drop zone (don't submit unless you want a new record).
3. **An incident detail page** — show the eight tabs; the Audit history tab is
   the compliance money-shot.
4. **5 Whys workspace** — edit a level live; the chain and summary update.
5. **CAPA** — show an overdue action and the SLA chart.
6. **Theme toggle** in settings/topbar — the whole design system is token
   driven, dark and light both WCAG AA.

## 4. If someone asks…

- *"Is the data real?"* — It is a seeded demonstration register; the landing
  page says so, and every figure is computed from it, not hard-coded.
- *"Is this production-ready?"* — The frontend is the production codebase;
  auth and persistence in the demo are client-side mocks, deliberately
  labelled, with the Django REST contract already wired behind
  `VITE_USE_MOCK=false`.
- *"Can we re-brand it?"* — Two-line edit: `--color-brand` and
  `--color-brand-hover` in `src/index.css`.
- *"Accessibility?"* — Semantic landmarks, visible focus rings, keyboard-only
  operation everywhere including the tour, status never by colour alone, and
  all motion honours `prefers-reduced-motion`.

## 5. Before you present

```bash
npm run typecheck    # strict TS
npm run verify       # + DOM smoke & interactive flows (flows needs Chrome)
```

If the tour ever misbehaves in front of an audience, `Esc` closes it and the
landing page is fully usable without it.
