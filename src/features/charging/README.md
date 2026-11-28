# Charging & Resource Management

- **UI/presentation:** Lợi (`ChargingPage.tsx` and visual components).
- **Business logic:** Kiệt; shared contracts/state live in `src/types/` and `src/store/`.

Charging requests from shared vehicles and private EVs use the shared store. Submission queues a request; scheduling may assign only an `AVAILABLE` charging point. `ASSIGNED` represents a reservation and does not mean the vehicle is charging.
