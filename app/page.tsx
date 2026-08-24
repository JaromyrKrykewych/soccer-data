import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      {/* Background glow decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-100 bg-linear-to-b from-emerald-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/40 backdrop-blur-md px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚽</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Soccer <span className="bg-linear-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">Data Hub</span>
              </h1>
              <p className="text-xs text-slate-500">Historial & Estadísticas de Copas Europeas</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
            Supabase Connection Active
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-16 flex-1 flex flex-col justify-center w-full">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Gestión Central de{" "}
            <span className="bg-linear-to-r from-emerald-400 via-teal-400 to-indigo-400 bg-clip-text text-transparent">
              Datos de Fútbol
            </span>
          </h2>
          <p className="text-slate-400 text-lg">
            Selecciona una de las secciones a continuación para administrar la base de datos, inspeccionar partidos o consultar el palmarés histórico.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
          {/* Card 1: Importador */}
          <Link
            href="/importer"
            className="group relative bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)] flex flex-col justify-between min-h-45 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300" />
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl p-2.5 bg-slate-900 border border-slate-800 rounded-xl group-hover:border-emerald-500/30 transition-colors">
                  📥
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-900/50 text-emerald-400">
                  Importación
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                Importador de Planillas
              </h3>
              <p className="text-sm text-slate-400">
                Sincroniza y valida datos de partidos y finales históricas desde Google Sheets hacia Supabase.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mt-4 group-hover:translate-x-1 transition-transform">
              Acceder al Importador <span>→</span>
            </div>
          </Link>

          {/* Card 2: Partidos */}
          <Link
            href="/matches"
            className="group relative bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] flex flex-col justify-between min-h-45 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all duration-300" />
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl p-2.5 bg-slate-900 border border-slate-800 rounded-xl group-hover:border-indigo-500/30 transition-colors">
                  ⚽
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950/50 border border-indigo-900/50 text-indigo-400">
                  Exploración
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                Partidos Guardados
              </h3>
              <p className="text-sm text-slate-400">
                Busca, filtra por competición o temporada, inspecciona y elimina registros de partidos importados.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 mt-4 group-hover:translate-x-1 transition-transform">
              Ver Partidos <span>→</span>
            </div>
          </Link>

          {/* Card 3: Estadísticas */}
          <Link
            href="/stats"
            className="group relative bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800 hover:border-violet-500/50 p-6 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)] flex flex-col justify-between min-h-45 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-all duration-300" />
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl p-2.5 bg-slate-900 border border-slate-800 rounded-xl group-hover:border-violet-500/30 transition-colors">
                  📊
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-950/50 border border-violet-900/50 text-violet-400">
                  Análisis
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-violet-400 transition-colors">
                Estadísticas de Clubes
              </h3>
              <p className="text-sm text-slate-400">
                Visualiza tablas de constancia de equipos, número de temporadas jugadas y total de rivales distintos.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 mt-4 group-hover:translate-x-1 transition-transform">
              Ver Estadísticas <span>→</span>
            </div>
          </Link>

          {/* Card 4: Palmarés / Títulos */}
          <Link
            href="/titles"
            className="group relative bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 p-6 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] flex flex-col justify-between min-h-45 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all duration-300" />
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl p-2.5 bg-slate-900 border border-slate-800 rounded-xl group-hover:border-amber-500/30 transition-colors">
                  🏆
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-900/50 text-amber-400">
                  Histórico
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                Palmarés por Competición
              </h3>
              <p className="text-sm text-slate-400">
                Explora el ranking de campeones y subcampeones y el historial completo año por año.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mt-4 group-hover:translate-x-1 transition-transform">
              Ver Palmarés <span>→</span>
            </div>
          </Link>

          {/* Card 5: H2H Histórico Cruzado */}
          <Link
            href="/historic"
            className="group relative bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800 hover:border-pink-500/50 p-6 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(236,72,153,0.15)] flex flex-col justify-between min-h-45 overflow-hidden md:col-span-2"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl group-hover:bg-pink-500/10 transition-all duration-300" />
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl p-2.5 bg-slate-900 border border-slate-800 rounded-xl group-hover:border-pink-500/30 transition-colors">
                  ⚔️
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-950/50 border border-pink-900/50 text-pink-400">
                  H2H Cruzado
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-pink-400 transition-colors">
                Enfrentamientos Históricos y Matriz H2H
              </h3>
              <p className="text-sm text-slate-400">
                Selecciona múltiples clubes para comparar sus partidos cara a cara en una matriz y ver los rivales comunes más frecuentes.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-pink-400 mt-4 group-hover:translate-x-1 transition-transform">
              Comparar Historiales <span>→</span>
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/20 py-6 px-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Soccer Data Hub. Diseñado con Next.js, Tailwind CSS y Supabase.</p>
      </footer>
    </div>
  );
}
