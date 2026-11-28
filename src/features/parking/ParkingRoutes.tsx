import { Route, Routes } from 'react-router'
import { useScrollTop } from '../../lib/useScrollTop'
import ParkingCheckInPage from './pages/ParkingCheckInPage'
import ParkingReservePage from './pages/ParkingReservePage'

export default function ParkingRoutes() {
  useScrollTop()
  return <Routes>
    <Route index element={<ParkingReservePage />} />
    <Route path=":reservationId" element={<ParkingCheckInPage />} />
  </Routes>
}
