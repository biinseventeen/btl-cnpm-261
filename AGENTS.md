# AGENTS.md — Smart E-Mobility Hub (CO3001, L01-N8)

## 1. Your role in this repository

You are assisting the L01-N8 student team with a one-week MVP/demo for the CO3001 Software Engineering project **Smart E-Mobility Hub**. Work as a careful implementation partner: inspect the existing code before editing, make focused changes, preserve the agreed architecture and Figma design, and verify the result.

This repository is a **frontend MVP using mock data and shared client-side state**. It is not the production system described by the full design document. Do not introduce a backend, database, MQTT broker, real IoT connection, authentication system, or complex infrastructure unless the user explicitly requests it.

## 2. Project goal and demo scope

Build one runnable web app that demonstrates the core flows of four business areas:

1. **Vehicle Journey & Reservation** — find a shared EV, reserve it, simulate QR pickup, view an active trip, and return the vehicle.
2. **Charging & Resource Management** — receive charging requests, queue and schedule them, manage charging-point/session states, monitor Hub capacity, and dispatch vehicles between Hubs.
3. **Parking & Private EV** — reserve parking capacity, check in and assign a physical slot, simulate sensor confirmation, and submit a private-EV charging request.
4. **Operation & What-if Simulation** — show live Hub/vehicle/charging/incident information, manage incidents, simulate scenarios on a snapshot, and apply recommendations only after revalidating live state.

The final demonstration should run as one connected story, not as four disconnected static pages. Prioritize end-to-end behavior and consistent shared data over implementing every detail of the full specification.

## 3. Current team ownership — latest agreement

The latest team decision overrides older ownership notes in the starter README or earlier planning documents:

| Member | Responsibility | Main code ownership |
|---|---|---|
| **Đinh Quốc Thịnh (team lead)** | Operation & What-if Simulation business logic; **all Parking & Private EV business logic**; shared types/store/mock data; integration and review | `src/features/operation/` and `src/features/parking/` **logic/services only**; `src/types/`, `src/store/`, `src/data/` |
| **Hà Ngọc Khải** | Vehicle Journey & Reservation business logic | `src/features/vehicle-journey/` **logic/services only** |
| **Võ Thái Kiệt** | Charging & Resource Management business logic | `src/features/charging/` **logic/services only** |
| **Bùi Hữu Lợi** | **All frontend/UI implementation across the app** (Student and Operator screens, including Parking and Private EV screens); routing, layouts, components, styling, and wiring UI to agreed store actions | All page/presentation `.tsx` files, shared visual components, layouts, navigation, and frontend styles across modules |

Important distinction: Lợi owns the presentation layer for every screen, including the `.tsx` page and visual component files inside all four feature folders. Thịnh owns Operation and Parking/Private EV domain behavior. Khải owns Vehicle Journey domain behavior. Kiệt owns Charging/Resource Management domain behavior. Logic owners should expose typed functions/actions; Lợi wires UI controls to those contracts. Do not reassign these responsibilities based on the starter's older comments.

## 4. Tech stack and commands

Use the dependencies already present in `package.json`; do not replace the framework or create a second app.

- React 19 + Vite 7
- TypeScript
- Tailwind CSS v4 through the Vite plugin
- React Router v7
- Zustand v5 for shared client state
- Lucide React for icons
- npm

Expected local environment: Node.js 22.12+ (or a version supported by the installed Vite version).

Commands:

```bash
npm install
npm run dev
npm run build
npm run preview
```

`npm run build` runs TypeScript project build and Vite production build. There is currently no guaranteed test or lint script; inspect `package.json` before suggesting/running one. Do not claim tests passed if none were run.

## 5. Existing repository structure and current scaffold

Inspect the actual repository before assuming files or paths. The starter currently follows this general structure:

```text
src/
  app/                    # App root and route definitions
  components/
    layout/               # Shared application shell/navigation
    shared/               # Reusable UI components
  data/
    mockData.ts           # Initial mock/seed data
  features/
    vehicle-journey/       # page/UI owned by Lợi; domain logic owned by Khải
    charging/              # page/UI owned by Lợi; domain logic owned by Kiệt
    parking/               # page/UI owned by Lợi; domain logic owned by Thịnh
    operation/             # page/UI owned by Lợi; domain logic owned by Thịnh
  store/
    useMobilityStore.ts    # Shared Zustand store
  types/
    index.ts              # Shared TypeScript contracts
  main.tsx
  styles.css
```

Current routes in the starter are:

- `/operator`
- `/student/vehicles`
- `/charging`
- `/parking`

The current `App.tsx` defines route elements and the app shell. Preserve working routes while adding or refining navigation. Do not rename or reorganize large parts of the project merely for style.

The current shared store is an **initial scaffold**, not a complete implementation. It contains starter actions such as `reserveVehicle`, `returnVehicle`, `scheduleChargingRequest`, `createParkingReservation`, `applySimulationRecommendation`, and `resolveIncident`. Inspect their actual implementation before modifying. Some behaviors are simplified and do not yet satisfy all workflows below.

Because the current starter colocates page components and feature behavior, preserve the team's ownership split by file responsibility: Lợi may edit the existing page/presentation `.tsx` files to implement Figma and wire controls; the relevant logic owner should implement business rules in clearly named services/actions and coordinate shared-store changes with Thịnh. Do not create duplicate page implementations or duplicate business state.

The current store is in-memory Zustand state. State resets on reload. Do not imply persistence exists unless it is implemented. LocalStorage can be added only if useful and coordinated with Thịnh; backend/database are not currently required.

## 6. Shared data and state rules

The single source of truth for shared domain state is `src/store/useMobilityStore.ts`, with shared interfaces/enums in `src/types/index.ts` and initial entities in `src/data/mockData.ts`.

Core shared entities include:

- `Hub`
- `Vehicle`
- `ChargingRequest`
- `ChargingPoint`
- `ParkingSlot`
- `ParkingReservation`
- `OperationalIncident`
- `DispatchOrder`
- `SimulationPreview`

Rules:

1. Do not create duplicate copies of the same Hub, Vehicle, ChargingRequest, or ChargingPoint inside individual feature components. Read and update shared state through store selectors/actions.
2. Components must not mutate store objects or arrays directly. Add/use named Zustand actions that perform state transitions.
3. Keep status values consistent with the shared TypeScript union types. Do not invent spelling variants such as `WAITING_CHARGE` when the agreed status is `PENDING_CHARGING`.
4. Treat `src/types/index.ts`, `src/store/useMobilityStore.ts`, `src/data/mockData.ts`, route definitions, and shared layout components as coordinated/shared files. Do not change these casually while implementing an isolated feature. When a change is needed, explain the contract impact and update all affected consumers.
5. Do not silently weaken invariants to make a UI button appear to work. Show a useful validation/error state instead.
6. Keep demo data deterministic and easy to reset/replay. Avoid depending on real current time for critical demo outcomes unless needed; use injectable/fixed demo timestamps when practical.
7. Use stable IDs and avoid generating duplicate requests/orders on repeated clicks where the workflow expects idempotent behavior.

The initial type definitions may not yet contain every field required by the design (for example, desired charging time window, battery verification, sensor heartbeat, slot hold expiry, or per-item dispatch progress). Before adding a field, compare the need with the project contract and explain the change. Thịnh is the contract owner; do not make incompatible cross-module type changes without coordination.

## 7. Business rules to preserve

### 7.1 Vehicle Journey — Khải owns the logic

- A shared vehicle may be reserved only if it is currently `AVAILABLE` and not already held by another active workflow.
- Simulate QR pickup with a UI action; a real QR scanner or physical lock is not required for the MVP.
- On successful pickup, move the reservation/vehicle into the appropriate picked-up/in-use state and update the source Hub occupancy consistently.
- On return, validate the destination Hub's receiving capacity before committing the return.
- Evaluate the returned vehicle condition in this priority order:
  1. Missing/stale heartbeat → `DISCONNECTED`.
  2. Fault code/technical problem → `UNAVAILABLE` and create an `OperationalIncident`.
  3. Battery at or below 20% → `PENDING_CHARGING` and create exactly one system-origin charging request (`source: SYSTEM`).
  4. Otherwise → `AVAILABLE`.
- A vehicle with a fault or stale telemetry must not become rentable merely because its battery is sufficient.
- Failed return validation must not partially close the trip or silently change Hub occupancy.

### 7.2 Charging & Resource Management — Kiệt owns the logic

- Accept requests produced by both Vehicle Journey and Private EV flows through the shared store/contract.
- A submitted request is initially `WAITING` or `NEEDS_VERIFICATION` as appropriate. Submitting a request must **not** immediately assign a charging point.
- Demo scheduler priority: lower verified battery first, then longer waiting time. Keep the rule deterministic and document it.
- Assign only an `AVAILABLE` charging point. `ASSIGNED` does not mean physically connected or `CHARGING`.
- Move a point to `CHARGING` only when the demo simulates a valid vehicle connection/start action.
- Support rescheduling/cancellation/failure states coherently and release the point when a request/session ends.
- Dispatch must validate both source-vehicle availability and destination Hub receiving capacity before updating any records.
- When applying a simulation recommendation, revalidate current live state. Return `STALE` and change no live resource state if the preview no longer matches available capacity/vehicles.

### 7.3 Parking & Private EV — Thịnh owns the logic; Lợi owns UI

Parking reservation is a **two-step** process:

1. **Reserve capacity:** check Hub capacity and create a `ParkingReservation` in `HELD`; increase/hold Hub capacity. Do not assign a physical parking slot yet.
2. **Check in:** recheck the reservation and select an eligible physical slot. Hold/assign a slot only at check-in. A candidate slot must be `FREE` and have a recent, healthy sensor reading. The design specifies a recent sensor signal (30-second freshness window).
3. **Sensor confirmation:** simulate a sensor event (e.g. `OCCUPIED`) for the assigned slot. Only after confirmation should the slot become `OCCUPIED`, the reservation become `ARRIVED`, and Hub counters be committed consistently.
4. On no eligible slot or sensor failure, expose a failure state, release relevant holds/capacity as required, and do not leave a phantom occupied/assigned slot.

Private EV charging:

- Validate that the private EV belongs to the student and that the desired time window is valid (`desiredEnd` after `desiredStart`).
- If verified battery data is unavailable, represent the request as `NEEDS_VERIFICATION` until the student provides a manual battery value; do not enqueue an unverified request as if verified.
- Once valid, create a `ChargingRequest` with student/private-EV source semantics agreed in the shared type contract. For the current starter, `source` is `SYSTEM | STUDENT`; do not invent another enum value without coordinating the type change.
- The request enters the Charging Queue; do not assign a port at submission time.

### 7.4 Operation & What-if Simulation — Thịnh owns the logic

- Dashboard is read-only with respect to domain state; derive Hub/Vehicle/Charging/Incident summaries from the shared store rather than maintaining a separate stale UI copy.
- Show Hub capacity using consistent counters. Capacity calculations should consider occupied, held, and incoming-reserved resources; never allow capacity to exceed total slots.
- Use the 85% Hub utilization threshold from the design when showing overcrowding/imbalance alerts, and apply it consistently.
- Incident flow should support at least open → in progress → resolved. Resolving an incident must not automatically make an unsafe vehicle rentable unless an explicit repair/restore action or validated state transition is implemented.
- What-if simulation runs against a snapshot of current state and hypothetical scenario parameters. It must not mutate live operational data.
- Recommendations may suggest moving vehicles between Hubs or changing charging schedules.
- Applying a recommendation must revalidate against current live state. If data changed, return/show `STALE`, explain why, and leave live resources unchanged.

## 8. Cross-module integration contracts

The MVP should make these flows observable across modules:

| Trigger / owner | Expected shared-state effect | Consumer |
|---|---|---|
| Khải returns a vehicle with battery ≤20% | Vehicle becomes `PENDING_CHARGING`; create one `SYSTEM` `ChargingRequest` | Kiệt's Charging Queue; Thịnh's Dashboard |
| Khải reports a vehicle fault or stale heartbeat | Vehicle becomes unavailable/disconnected; create an `OperationalIncident` | Thịnh's Incident Management/Dashboard |
| Thịnh creates a Parking Reservation | Hold Hub parking capacity; do not select a physical slot yet | Lợi's Parking UI |
| Thịnh checks in a parking reservation | Assign a physical slot after revalidation | Lợi's Parking UI |
| Parking sensor confirmation | Slot becomes `OCCUPIED`; reservation becomes `ARRIVED`; Hub counters update | Lợi's Parking UI; Thịnh's Dashboard |
| Thịnh submits a valid Private EV charging request | Create `ChargingRequest`; do not assign a port immediately | Kiệt's Charging Queue; Lợi's UI |
| Kiệt schedules/reschedules a charging request | Update request status, expected time and port assignment as supported by the contract | Student UI; Thịnh's Dashboard |
| Thịnh applies a dispatch recommendation | Ask Kiệt's dispatch logic to revalidate and commit; return `APPLIED` or `STALE` | Thịnh's Simulation UI; Kiệt's Dispatch view |

Prefer explicit, typed store actions or small service functions over direct component-to-component calls. Avoid circular imports between feature modules. Shared types belong in `src/types`; shared state transitions belong in the shared store or a clearly separated domain/service layer agreed by the team.

## 9. Figma and UI expectations

Use the team's existing Figma as the UI source of truth. Do not redesign screens, rename visual concepts, or invent a new visual system unless the user explicitly asks.

Figma file:
https://www.figma.com/design/OKGcNqqhLy6E4g4uaprnii/ui-mockup?node-id=69-158&t=9pYoBeiIGt5LAvBC-1

Known Operator screens include:
- `Operations_Network_Overview_Screen`
- `Operations_Incident_Management_Screen`
- `Operations_Dispatch_Recommendations_Screen`
- `Operations_What_If_Simulation_Screen`

Known Student screens include vehicle search/reservation, trip and return, plus parking reservation/check-in and private EV-related flows. Verify exact frames from Figma when the user asks for a specific screen; do not assume every screen/frame name from memory.

Lợi is responsible for implementing all frontend presentation. Other members should expose agreed data/actions and communicate what the UI needs. Avoid making duplicate UI pages in the logic-owned feature branches unless required by the existing architecture and coordinated with Lợi.

UI quality:
- Match the supplied Figma layout, visual hierarchy, typography, spacing, colors, and important states.
- Make controls functional; do not leave primary demo buttons decorative.
- Include loading/empty/error/success feedback where relevant.
- Keep student-facing and operator-facing experiences distinct.
- Ensure the app remains usable at the target demo screen size; do not spend time on extensive responsive polish before core flows work.

## 10. Git workflow and collaboration

The agreed branches are:

- `main` — stable/release-ready only.
- `integration` — shared integration branch managed by Thịnh.
- `feat/thinh-business-logic` — Thịnh (Operation/Simulation and Parking/Private EV logic).
- `feat/vehicle-journey-logic` — Khải.
- `feat/charging-logic` — Kiệt.
- `feat/frontend` — Lợi (all UI/presentation work).

Feature branches should be based on `integration`. Open Pull Requests from each feature branch into `integration`. Thịnh reviews/builds the integrated result. Merge `integration` into `main` only after the end-to-end demo is stable.

When a task touches a file shared by multiple roles (especially a page `.tsx` that calls store actions), keep the change focused and coordinate the function signature with the logic owner. Do not let frontend and logic branches implement competing versions of the same behavior.

Never:
- Commit or push directly to `main` unless the user explicitly asks.
- Force-push, reset shared branches, delete branches, rewrite history, or run destructive Git commands without explicit approval.
- Modify teammate-owned files outside the requested task without explaining the reason.
- Claim a PR, merge, push, or remote action was completed unless it actually was.

Before editing, check `git status`, current branch, and recent changes. Never overwrite uncommitted user work. If the working tree contains other people's changes, preserve them.

## 11. How to work on tasks in this repository

For every coding task:

1. Inspect relevant files and the current implementation first. Do not assume the scaffold matches this document perfectly.
2. Identify the affected feature, shared types/actions, and consumers in other modules.
3. State a short implementation plan and note any contract changes before large edits.
4. Make the smallest coherent change that completes the requested task. Avoid broad refactors and unnecessary dependencies.
5. Keep TypeScript types explicit; avoid `any` unless there is a documented reason.
6. Handle invalid input and unsuccessful business transitions with visible, understandable feedback.
7. Update relevant module README or root README when routes, setup, actions, or workflows change.
8. Run `npm run build` after meaningful changes. If it fails, report the exact failure and do not claim success. Run any relevant tests only if such scripts/tests exist.
9. Summarize files changed, behavior added, validation performed, and remaining gaps.

When the user asks for implementation, edit the code rather than only giving advice. Do not ask for confirmation for routine, reversible coding choices. Ask only when a missing decision would materially change the architecture or business behavior.

## 12. Demo timeline and priorities

The team's seven-day plan is dated 26/11/2026–02/12/2026 (02/12 is an internal target, not a confirmed LMS deadline):

- D1 (26/11): repository, app setup, shared contract, mock data, review Figma.
- D2 (27/11): build main screen layouts/routes and shared navigation.
- D3 (28/11): core business flows work with mock data.
- D4 (29/11): cross-module integration.
- D5 (30/11): exceptions and data consistency.
- D6 (01/12): end-to-end testing and UI polish.
- D7 (02/12): feature freeze and full rehearsal.

Prioritize in this order:
1. App starts and all main routes render.
2. Core workflows for all four areas work.
3. Cross-module shared-state flows work end-to-end.
4. Important exceptions are handled (Hub full, vehicle fault/disconnected, no charging point, sensor not confirming occupancy, stale simulation recommendation).
5. Figma fidelity and visual polish.
6. Optional backend, real database, IoT, or other production features only if time remains and explicitly approved.

## 13. Important source context

Use the following project materials when available in the workspace; the approved documents take precedence over assumptions:

- `Submission_3_L01_N8.pdf` — submitted design: Deployment View, Development View, class diagrams, method descriptions, and test scenarios. In particular, consult the method tables and test cases for exact business behavior.
- `phan cong submission 4.docx` / the team's seven-day Build Demo plan — current scope, ownership, daily milestones, integration events, demo sequence, and acceptance criteria.
- Existing Figma file — authoritative visual reference.

Do not invent requirements that are not in the design or team plan. If a detail is unspecified, identify it as an implementation assumption and choose the simplest deterministic behavior appropriate for the MVP.

## 14. Definition of done

A feature is not done merely because the screen renders. It is done when:

- The screen follows the relevant Figma frame.
- Primary controls perform the stated action.
- Shared state changes correctly and is visible to dependent modules.
- Business invariants and failure paths are preserved.
- TypeScript/Vite production build succeeds.
- The module README/PR explains routes, store actions, demo data, and remaining limitations.

The whole MVP is ready for rehearsal when the team can run the six-step end-to-end demo from the build plan without manually editing data between steps, reset the seed data, and reproduce the flow reliably.
