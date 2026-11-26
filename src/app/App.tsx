import { Navigate, Route, Routes } from 'react-router'
import AppShell from '../components/layout/AppShell'
import OperationPage from '../features/operation/OperationPage'
import VehicleJourneyPage from '../features/vehicle-journey/VehicleJourneyPage'
import ChargingPage from '../features/charging/ChargingPage'
import ParkingPage from '../features/parking/ParkingPage'

export default function App() {
  return <Routes>
    <Route element={<AppShell />}>
      <Route index element={<Navigate to="/operator" replace />} />
      <Route path="/operator" element={<OperationPage />} />
      <Route path="/student/vehicles" element={<VehicleJourneyPage />} />
      <Route path="/charging" element={<ChargingPage />} />
      <Route path="/parking" element={<ParkingPage />} />
      <Route path="*" element={<Navigate to="/operator" replace />} />
    </Route>
  </Routes>
}