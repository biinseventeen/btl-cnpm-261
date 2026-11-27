# Operation & What-if Simulation

- **UI/presentation:** Lợi (`OperationPage.tsx` and visual components).
- **Business logic:** Thịnh; shared contracts/state live in `src/types/` and `src/store/`.

Dashboard data is derived from the shared store. What-if previews use a snapshot; applying a recommendation must revalidate live vehicle availability and Hub capacity before updating shared state.
