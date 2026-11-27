# Vehicle Journey & Reservation

- **UI/presentation:** Lợi (`VehicleJourneyPage.tsx` and visual components).
- **Business logic:** Khải; shared contracts/state live in `src/types/` and `src/store/`.

The flow uses the shared Vehicle and Hub records. Reservation, simulated QR pickup, trip state, and return validation must update through named store actions so other modules see consistent occupancy and vehicle status.
