import { Navigate, Route, Routes } from 'react-router'
import { WorkspaceLayout } from '../components/layout/AppShell'
import { TripRoutes, VehicleRoutes } from '../features/vehicle-journey/VehicleJourneyRoutes'
import ParkingRoutes from '../features/parking/ParkingRoutes'
import PrivateEvRoutes from '../features/parking/PrivateEvRoutes'
import ParkingSlotsPage from '../features/parking/pages/ParkingSlotsPage'
import OverviewPage from '../features/operation/pages/OverviewPage'
import IncidentsPage from '../features/operation/pages/IncidentsPage'
import SimulationPage from '../features/operation/pages/SimulationPage'
import SimulationResultPage from '../features/operation/pages/SimulationResultPage'
import HubChargingPage from '../features/charging/pages/HubChargingPage'
import ChargingQueuePage from '../features/charging/pages/ChargingQueuePage'
import DispatchPage from '../features/charging/pages/DispatchPage'

export default function App() {
  return <Routes>
    <Route index element={<Navigate to="/student/vehicles" replace />} />
    <Route path="/student" element={<WorkspaceLayout role="student" />}>
      <Route index element={<Navigate to="vehicles" replace />} />
      <Route path="vehicles/*" element={<VehicleRoutes />} />
      <Route path="trips/*" element={<TripRoutes />} />
      <Route path="parking/*" element={<ParkingRoutes />} />
      <Route path="private-ev/*" element={<PrivateEvRoutes />} />
    </Route>
    <Route path="/operator" element={<WorkspaceLayout role="operator" />}>
      <Route index element={<OverviewPage />} />
      <Route path="hubs" element={<HubChargingPage />} />
      <Route path="charging-queue" element={<ChargingQueuePage />} />
      <Route path="dispatch" element={<DispatchPage />} />
      <Route path="incidents" element={<IncidentsPage />} />
      <Route path="simulation" element={<SimulationPage />} />
      <Route path="simulation/result" element={<SimulationResultPage />} />
      <Route path="parking-slots" element={<ParkingSlotsPage />} />
    </Route>
    <Route path="/charging" element={<Navigate to="/operator/charging-queue" replace />} />
    <Route path="/parking" element={<Navigate to="/student/parking" replace />} />
    <Route path="*" element={<Navigate to="/student/vehicles" replace />} />
  </Routes>
}
