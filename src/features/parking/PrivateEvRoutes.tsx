import { Route, Routes } from 'react-router'
import { useScrollTop } from './useScrollTop'
import ChargingRequestDetailPage from './pages/ChargingRequestDetailPage'
import PrivateEvChargingPage from './pages/PrivateEvChargingPage'

export default function PrivateEvRoutes() {
  useScrollTop()
  return <Routes>
    <Route index element={<PrivateEvChargingPage />} />
    <Route path=":requestId" element={<ChargingRequestDetailPage />} />
  </Routes>
}
