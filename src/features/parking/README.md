# Parking & Private EV

- **UI/presentation:** Lợi (`ParkingPage.tsx` and visual components).
- **Business logic:** Thịnh; shared contracts/state live in `src/types/` and `src/store/`.

Parking reserves Hub capacity first (`HELD`), then selects a physical slot at check-in after validating sensor health/freshness. A slot and Hub occupancy are committed only after simulated sensor confirmation. Valid private-EV charging requests enter the shared charging queue without assigning a charging point during submission.
