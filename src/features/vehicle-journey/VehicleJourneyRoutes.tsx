import { Route, Routes } from 'react-router'
import { useScrollTop } from '../../lib/useScrollTop'
import FindVehiclePage from './pages/FindVehiclePage'
import MyTripPage from './pages/MyTripPage'
import PickupPage from './pages/PickupPage'
import ReserveVehiclePage from './pages/ReserveVehiclePage'

export function VehicleRoutes() {
  useScrollTop()
  return <Routes>
    <Route index element={<FindVehiclePage />} />
    <Route path=":vehicleId/reserve" element={<ReserveVehiclePage />} />
  </Routes>
}

export function TripRoutes() {
  useScrollTop()
  return <Routes>
    <Route index element={<MyTripPage />} />
    <Route path="pickup" element={<PickupPage />} />
  </Routes>
}
