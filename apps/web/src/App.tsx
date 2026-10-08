import { Route, Routes } from 'react-router-dom'
import { AsesorPage, DolphinPage, HomePage, TallerPage } from '@/pages'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/modelos/dolphin" element={<DolphinPage />} />
      <Route path="/asesor" element={<AsesorPage />} />
      <Route path="/taller" element={<TallerPage />} />
    </Routes>
  )
}
