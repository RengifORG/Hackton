import { Navigate, Route, Routes } from 'react-router-dom'
import { AsesorPage, HomePage, SeagullPage, TallerPage } from '@/pages'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/modelos/seagull" element={<SeagullPage />} />
      {/* Enlaces antiguos: el 3D siempre fue un Seagull. */}
      <Route
        path="/modelos/dolphin"
        element={<Navigate to="/modelos/seagull" replace />}
      />
      <Route path="/asesor" element={<AsesorPage />} />
      <Route path="/taller" element={<TallerPage />} />
    </Routes>
  )
}
