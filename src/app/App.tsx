import { Navigate, Route, Routes } from 'react-router'
import AppShell from '../components/layout/AppShell'
import OperationPage from '../features/operation/OperationPage'
import VehicleJourneyPage from '../features/vehicle-journey/VehicleJourneyPage'
import ChargingPage from '../features/charging/ChargingPage'
import ParkingRoutes from '../features/parking/ParkingRoutes'
import PrivateEvRoutes from '../features/parking/PrivateEvRoutes'
import ParkingSlotsPage from '../features/parking/pages/ParkingSlotsPage'

export default function App() {
  return <Routes>
    <Route element={<AppShell />}>
      <Route index element={<Navigate to="/operator" replace />} />
      <Route path="/operator" element={<OperationPage />} />
      <Route path="/student/vehicles" element={<VehicleJourneyPage />} />
      <Route path="/charging" element={<ChargingPage />} />
      <Route path="/student/parking/*" element={<ParkingRoutes />} />
      <Route path="/student/private-ev/*" element={<PrivateEvRoutes />} />
      <Route path="/operator/parking-slots" element={<ParkingSlotsPage />} />
      <Route path="/parking" element={<Navigate to="/student/parking" replace />} />
      <Route path="*" element={<Navigate to="/operator" replace />} />
    </Route>
  </Routes>
}