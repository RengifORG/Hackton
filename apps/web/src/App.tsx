import { Route, Routes } from 'react-router-dom'
import { DolphinPage, HomePage } from '@/pages'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/modelos/dolphin" element={<DolphinPage />} />
    </Routes>
  )
}
