import { Route, Routes } from 'react-router'
import { useScrollTop } from './useScrollTop'
import { startParkingExpiryJob } from './expiryJob'
import ParkingCheckInPage from './pages/ParkingCheckInPage'
import ParkingReservePage from './pages/ParkingReservePage'

startParkingExpiryJob()

export default function ParkingRoutes() {
  useScrollTop()
  return <Routes>
    <Route index element={<ParkingReservePage />} />
    <Route path=":reservationId" element={<ParkingCheckInPage />} />
  </Routes>
}
