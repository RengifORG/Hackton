import { Link } from 'react-router-dom'

const NAV_CARDS = [
  {
    to: '/modelos/dolphin',
    title: 'Ver el Dolphin en 3D',
    description: 'Gíralo 360°, toca sus partes y pregunta al asesor.',
  },
  {
    to: '/asesor',
    title: 'Bandeja del asesor',
    description: 'Leads captados por el chat, incluso fuera de horario.',
  },
  {
    to: '/taller',
    title: 'Agenda del taller',
    description: 'Citas de servicio agendadas desde el chat.',
  },
]

export function HomePage() {
  return (
    <main className="min-h-dvh bg-slate-50">
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-12 text-center md:pt-24">
        <p className="text-sm font-semibold tracking-widest text-red-600 uppercase">
          BYD Ecuador · Asesor virtual 24/7
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
          Tu BYD, a cualquier hora
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          El call center cierra a las 18:00, pero tus preguntas no. Nuestro
          asesor virtual te atiende las 24 horas: conoce el Dolphin, deja tus
          datos y agenda tu prueba de manejo sin esperar al día siguiente.
        </p>
        <Link
          to="/modelos/dolphin"
          className="mt-8 inline-block rounded-full bg-slate-900 px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-slate-700"
        >
          Hablar con el asesor virtual
        </Link>
      </section>

      <nav
        aria-label="Secciones de la demo"
        className="mx-auto max-w-5xl px-4 pb-16"
      >
        <ul className="grid gap-4 md:grid-cols-3">
          {NAV_CARDS.map(({ to, title, description }) => (
            <li key={to + title}>
              <Link
                to={to}
                className="block h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <h2 className="text-lg font-semibold text-slate-900">
                  {title}
                </h2>
                <p className="mt-2 text-sm text-slate-600">{description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  )
}
