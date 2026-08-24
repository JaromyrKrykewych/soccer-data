import { NextResponse } from 'next/server';
import { ApiSourceService } from '@/services';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Opciones de búsqueda
  let team1 = searchParams.get('team1') || 'Real Madrid';
  let team2 = searchParams.get('team2') || 'Benfica';
  let h2hParam = searchParams.get('h2h'); // ej. "541-211"

  try {
    let finalH2HString = h2hParam;

    // Si no se pasa el h2hParam directo, buscamos los equipos para obtener sus IDs
    if (!finalH2HString) {
      console.log(`Buscando IDs para: ${team1} y ${team2}`);
      
      const [teams1Result, teams2Result] = await Promise.all([
        ApiSourceService.getTeams({ name: team1 }),
        ApiSourceService.getTeams({ name: team2 }),
      ]);

      const team1Data = teams1Result[0];
      const team2Data = teams2Result[0];

      if (!team1Data || !team2Data) {
        return NextResponse.json(
          {
            error: 'No se encontraron uno o ambos equipos.',
            searched: { team1, team2 },
            results: { team1: teams1Result, team2: teams2Result },
          },
          { status: 404 }
        );
      }

      finalH2HString = `${team1Data.team.id}-${team2Data.team.id}`;
      console.log(`Encontrado H2H string: ${finalH2HString} (${team1Data.team.name} vs ${team2Data.team.name})`);
    }

    console.log(`Llamando a H2H con: ${finalH2HString}`);
    const matches = await ApiSourceService.getH2H({ h2h: finalH2HString });

    // Ordenar partidos por fecha descendente
    const sortedMatches = matches.sort(
      (a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime()
    );

    // Mapear un resumen simple para que sea fácil de leer en el navegador
    const summary = sortedMatches.map((m) => ({
      fecha: m.fixture.date,
      competicion: `${m.league.name} (Temporada ${m.league.season})`,
      ronda: m.league.round,
      local: m.teams.home.name,
      visitante: m.teams.away.name,
      marcador: `${m.goals.home} - ${m.goals.away}`,
      marcador_penales: m.score.penalty.home !== null ? `(${m.score.penalty.home} - ${m.score.penalty.away} pen)` : null,
      estadio: m.fixture.venue.name,
      arbitro: m.fixture.referee,
    }));

    return NextResponse.json({
      success: true,
      h2h: finalH2HString,
      total_partidos: matches.length,
      resumen: summary,
      raw_response: sortedMatches,
    });
  } catch (error: any) {
    console.error('Error en API H2D:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error desconocido al obtener Head-to-Head',
      },
      { status: 500 }
    );
  }
}
