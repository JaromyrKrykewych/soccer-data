import { getParsedSheetData } from '@/services';
import { supabase } from '@/services/supabase/supabase';
import { NextResponse } from 'next/server';

/**
 * Mapea el código abreviado de la competición de Google Sheets al nombre oficial e histórico 
 * según el año de inicio de la temporada.
 */
function getCompetitionFullName(code: string, yearStart: number): string {
  const c = code.toUpperCase().trim();
  if (c === 'CL') {
    return yearStart <= 1991 ? 'Copa de Europa' : 'UEFA Champions League';
  }
  if (c === 'EL') {
    return yearStart <= 2008 ? 'Copa UEFA' : 'UEFA Europa League';
  }
  if (c === 'CW') {
    return 'Recopa de Europa';
  }
  if (c === 'FC') {
    return 'Copa de Ferias';
  }
  if (c === 'CO' || c === 'ECL' || c === 'CONF') {
    return 'UEFA Europa Conference League';
  }
  if (c === 'SC') {
    return 'Supercopa de Europa';
  }
  return code;
}

/**
 * Determina el ganador (winner) y perdedor (loser) a partir de los datos de un partido o eliminatoria.
 */
function determineWinnerAndLoser(row: {
  year: string;
  firstLeg: string;
  secondLeg?: string;
  agg?: string;
}) {
  const yearStartStr = row.year.includes('/') ? row.year.split('/')[0] : row.year.split('-')[0];
  const yearStart = parseInt(yearStartStr, 10);

  // Parseamos la ida (local vs visitante)
  const [scoreHome1, scoreAway1] = row.firstLeg.split('-').map(Number);
  if (isNaN(scoreHome1) || isNaN(scoreAway1)) return null;

  let goalsA = scoreHome1;
  let goalsB = scoreAway1;

  const isSingleLeg = !row.secondLeg || row.secondLeg.trim() === '' || row.secondLeg.trim() === '-';

  let scoreA_2 = NaN;
  let scoreB_2 = NaN;

  if (!isSingleLeg && row.secondLeg) {
    const parts = row.secondLeg.split('-').map(Number);
    const scoreA_2_val = parts[0]; // Goles del Equipo A (visitante en la vuelta)
    const scoreB_2_val = parts[1]; // Goles del Equipo B (local en la vuelta)
    if (!isNaN(scoreA_2_val) && !isNaN(scoreB_2_val)) {
      scoreA_2 = scoreA_2_val;
      scoreB_2 = scoreB_2_val;
      goalsA += scoreA_2;
      goalsB += scoreB_2;
    }
  }

  if (goalsA > goalsB) {
    return { winner: 'A', loser: 'B' };
  }
  if (goalsB > goalsA) {
    return { winner: 'B', loser: 'A' };
  }

  // Si hay empate global, recurrimos a agg (penales o partido de desempate)
  if (row.agg && row.agg.trim() !== '') {
    const parts = row.agg.split('-').map(Number);
    const aggA = parts[0]; // Penales/desempate de A
    const aggB = parts[1]; // Penales/desempate de B

    if (!isNaN(aggA) && !isNaN(aggB)) {
      if (aggA > aggB) {
        return { winner: 'A', loser: 'B' };
      }
      if (aggB > aggA) {
        return { winner: 'B', loser: 'A' };
      }
    }
  }

  // Si no se definió por penales/desempate y es a doble partido, aplicamos la regla de gol de visitante
  if (!isSingleLeg && !isNaN(scoreA_2) && !isNaN(scoreB_2)) {
    const awayGoalsA = scoreA_2; // Goles de A como visitante (vuelta)
    const awayGoalsB = scoreAway1; // Goles de B como visitante (ida)
    if (awayGoalsA > awayGoalsB) {
      return { winner: 'A', loser: 'B' };
    }
    if (awayGoalsB > awayGoalsA) {
      return { winner: 'B', loser: 'A' };
    }
  }

  return null;
}

// Interfaz enriquecida para responder al frontend
interface DBTeamInfo {
  id: number;
  current_name: string;
  country: string;
  api_sports_id: number | null;
  aliases: string[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sheetName = searchParams.get('sheet') || '2026-27';
  const sheetId = process.env.GOOGLE_SHEET_ID || '';
  const range = `'${sheetName}'!A:J`;

  try {
    // 1. Obtener los datos de Google Sheets (o fallback local)
    const sheetRows = await getParsedSheetData(sheetId, range);

    // 2. Obtener los equipos de Supabase
    const { data: dbTeams, error: teamsError } = await supabase
      .from('teams')
      .select(`
        id,
        current_name,
        founded_year,
        country_id,
        api_sports_id,
        countries (
          id,
          name,
          iso_code
        )
      `);

    if (teamsError) {
      throw new Error(`Error en Supabase Teams: ${teamsError.message}`);
    }

    // 3. Obtener todos los alias (nombres) de Supabase
    const { data: dbAliases, error: aliasesError } = await supabase
      .from('teamnames')
      .select('id, team_id, name');

    if (aliasesError) {
      throw new Error(`Error en Supabase TeamNames: ${aliasesError.message}`);
    }

    // Formatear la lista de equipos registrados para enviarla al cliente
    const formattedTeams: DBTeamInfo[] = (dbTeams || []).map((t: any) => {
      const aliases = (dbAliases || [])
        .filter((a) => a.team_id === t.id)
        .map((a) => a.name);

      return {
        id: t.id,
        current_name: t.current_name,
        country: t.countries?.name || 'Desconocido',
        api_sports_id: t.api_sports_id,
        aliases: Array.from(new Set([t.current_name, ...aliases])),
      };
    });

    // Función auxiliar para buscar equipo por nombre o alias
    const findTeam = (name: string): DBTeamInfo | null => {
      return formattedTeams.find(
        (t) =>
          t.current_name.toLowerCase() === name.toLowerCase() ||
          t.aliases.some((alias) => alias.toLowerCase() === name.toLowerCase())
      ) || null;
    };

    // Parseamos los años a partir de sheetName (ej: "2024/25" o "2024-25" -> yearStart: 2024, yearEnd: 2025)
    const separator = sheetName.includes('/') ? '/' : '-';
    const parts = sheetName.split(separator);
    const yearStart = parseInt(parts[0], 10);
    let yearEnd = yearStart + 1;
    if (parts[1]) {
      const endPart = parseInt(parts[1], 10);
      yearEnd = endPart < 100 ? Math.floor(yearStart / 100) * 100 + endPart : endPart;
    }

    // 4. Obtener partidos importados de Supabase (con try-catch por si aún no existen las tablas de partidos)
    let importedMatches: any[] = [];
    let matchesTableExists = true;

    try {
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          season_id,
          home_team_id,
          away_team_id,
          is_leg1,
          round,
          seasons!inner (
            year_start,
            year_end,
            competitions (
              name,
              api_sports_id
            )
          )
        `)
        .eq('seasons.year_start', yearStart)
        .eq('seasons.year_end', yearEnd);

      if (matchesError) {
        matchesTableExists = false;
      } else {
        importedMatches = matches || [];
      }
    } catch (e) {
      matchesTableExists = false;
    }

    // 4.5. Obtener títulos importados de Supabase
    let importedTitles: any[] = [];
    let titlesTableExists = true;

    try {
      const { data: checkTitles, error: checkTitlesError } = await supabase
        .from('titles')
        .select('id')
        .limit(1);

      if (checkTitlesError) {
        titlesTableExists = false;
      } else {
        const { data: titles, error: titlesError } = await supabase
          .from('titles')
          .select(`
            id,
            team_id,
            competition_id,
            season_id,
            title_name,
            seasons!inner (
              year_start,
              year_end,
              competitions (
                name
              )
            )
          `)
          .eq('seasons.year_start', yearStart)
          .eq('seasons.year_end', yearEnd);

        if (titlesError) {
          titlesTableExists = false;
        } else {
          importedTitles = titles || [];
        }
      }
    } catch (e) {
      titlesTableExists = false;
    }

    // 5. Enriquecer las filas del Google Sheet con el estado real de Supabase
    const enrichedRows = sheetRows.map((row) => {
      const teamA_db = findTeam(row.teamA);
      const teamB_db = findTeam(row.teamB);

      let leg1_imported = false;
      let leg2_imported = false;
      let titles_imported = false;

      // Si ambos equipos están registrados y las tablas de partidos existen
      if (teamA_db && teamB_db && matchesTableExists) {
        // Buscamos si existe la ida (A de local, B de visitante)
        leg1_imported = importedMatches.some((m) => {
          const yearStartStr = row.year.includes('/') ? row.year.split('/')[0] : row.year.split('-')[0];
          const yearStart = parseInt(yearStartStr);
          const mappedCompName = getCompetitionFullName(row.competition, yearStart);
          return (
            m.home_team_id === teamA_db.id &&
            m.away_team_id === teamB_db.id &&
            m.is_leg1 === true &&
            m.round === row.instance &&
            m.seasons?.year_start === yearStart &&
            m.seasons?.competitions?.name === mappedCompName
          );
        });

        // Buscamos si existe la vuelta (B de local, A de visitante)
        leg2_imported = importedMatches.some((m) => {
          const yearStartStr = row.year.includes('/') ? row.year.split('/')[0] : row.year.split('-')[0];
          const yearStart = parseInt(yearStartStr);
          const mappedCompName = getCompetitionFullName(row.competition, yearStart);
          return (
            m.home_team_id === teamB_db.id &&
            m.away_team_id === teamA_db.id &&
            m.is_leg1 === false &&
            m.round === row.instance &&
            m.seasons?.year_start === yearStart &&
            m.seasons?.competitions?.name === mappedCompName
          );
        });
      }

      // Si es final y ambos equipos están mapeados
      if (row.instance === 'F' && teamA_db && teamB_db && titlesTableExists) {
        const yearStartStr = row.year.includes('/') ? row.year.split('/')[0] : row.year.split('-')[0];
        const yearStartVal = parseInt(yearStartStr, 10);
        const mappedCompName = getCompetitionFullName(row.competition, yearStartVal);
        const compTitles = importedTitles.filter((t) => 
          t.seasons?.year_start === yearStartVal &&
          t.seasons?.competitions?.name === mappedCompName
        );
        // Títulos importados si existen campeón y subcampeón (2 registros)
        titles_imported = compTitles.length >= 2;
      }

      return {
        ...row,
        teamA_db,
        teamB_db,
        leg1_imported,
        leg2_imported,
        titles_imported,
      };
    });

    return NextResponse.json({
      success: true,
      rows: enrichedRows,
      all_db_teams: formattedTeams,
      matches_table_exists: matchesTableExists,
      titles_table_exists: titlesTableExists,
    });
  } catch (error: any) {
    console.error('Error fetching data in API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error en el servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // --- ACCIÓN: REGISTRAR CLUB NUEVO ---
    if (action === 'register-team') {
      const { name, country, country_iso_code, api_sports_id } = body;
      if (!name || !country) {
        return NextResponse.json({ success: false, error: 'Faltan campos requeridos: name o country' }, { status: 400 });
      }

      // 1. Asegurar que el país exista en la base de datos
      let countryId: number;

      const { data: countryData, error: countryGetErr } = await supabase
        .from('countries')
        .select('id')
        .ilike('name', country)
        .maybeSingle();

      if (countryGetErr) throw countryGetErr;

      if (countryData) {
        countryId = countryData.id;
      } else {
        // Creamos el país si no existe
        const { data: newCountry, error: countryInsertErr } = await supabase
          .from('countries')
          .insert({
            name: country,
            iso_code: country_iso_code || null
          })
          .select('id')
          .single();

        if (countryInsertErr) throw countryInsertErr;
        countryId = newCountry.id;
      }

      // 2. Crear el equipo
      const { data: newTeam, error: teamInsertErr } = await supabase
        .from('teams')
        .insert({
          current_name: name,
          country_id: countryId,
          api_sports_id: api_sports_id ? Number(api_sports_id) : null,
        })
        .select()
        .single();

      if (teamInsertErr) {
        // Si el equipo ya existe (por UNIQUE constraint), lo recuperamos
        if (teamInsertErr.code === '23505') {
          const { data: existingTeam } = await supabase
            .from('teams')
            .select()
            .ilike('current_name', name)
            .single();
          return NextResponse.json({ success: true, team: existingTeam });
        }
        throw teamInsertErr;
      }

      // 3. Agregar el nombre actual como el primer alias en TeamNames
      await supabase
        .from('teamnames')
        .insert({
          team_id: newTeam.id,
          name: name,
        });

      return NextResponse.json({ success: true, team: newTeam });
    }

    // --- ACCIÓN: VINCULAR ALIAS A CLUB EXISTENTE ---
    if (action === 'map-alias') {
      const { team_id, alias } = body;
      if (!team_id || !alias) {
        return NextResponse.json({ success: false, error: 'Faltan campos requeridos: team_id o alias' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('teamnames')
        .insert({
          team_id: Number(team_id),
          name: alias,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // El alias ya existe para ese equipo, lo consideramos éxito
          return NextResponse.json({ success: true, message: 'Alias ya registrado' });
        }
        throw error;
      }

      return NextResponse.json({ success: true, alias: data });
    }

    // --- ACCIÓN: IMPORTAR PARTIDOS (IDA Y VUELTA O ÚNICO) ---
    if (action === 'import-matches') {
      const {
        year,
        competition,
        instance,
        teamA_id,
        teamB_id,
        firstLeg,
        secondLeg,
        agg,
      } = body;

      if (!year || !competition || !instance || !teamA_id || !teamB_id || !firstLeg) {
        return NextResponse.json({ success: false, error: 'Faltan campos obligatorios para importar los partidos.' }, { status: 400 });
      }

      // Parseamos los años (ej: "2024/25" o "2024-25" -> year_start: 2024, year_end: 2025)
      const separator = year.includes('/') ? '/' : '-';
      const parts = year.split(separator);
      const yearStart = parseInt(parts[0]);
      let yearEnd = yearStart + 1;
      if (parts[1]) {
        const endPart = parseInt(parts[1]);
        yearEnd = endPart < 100 ? Math.floor(yearStart / 100) * 100 + endPart : endPart;
      }

      // Mapeamos el nombre completo de la competición según el año
      const mappedCompName = getCompetitionFullName(competition, yearStart);

      // 1. Asegurar que exista la Competición en Supabase
      let competitionId: number;
      const { data: compData, error: compGetErr } = await supabase
        .from('competitions')
        .select('id')
        .ilike('name', mappedCompName)
        .maybeSingle();

      if (compGetErr) {
        return NextResponse.json({
          success: false,
          error: 'Error consultando la tabla Competitions. Asegúrate de ejecutar el script SQL de las tablas 5 a 9 en Supabase.'
        }, { status: 400 });
      }

      if (compData) {
        competitionId = compData.id;
      } else {
        // Asignamos el api_sports_id según la competición oficial si es conocida
        let apiSportsId: number | null = null;
        if (mappedCompName === 'UEFA Champions League') apiSportsId = 3;
        else if (mappedCompName === 'UEFA Europa League') apiSportsId = 4;
        else if (mappedCompName === 'UEFA Europa Conference League') apiSportsId = 683;

        const { data: newComp, error: compInsertErr } = await supabase
          .from('competitions')
          .insert({
            name: mappedCompName,
            type: 'international',
            api_sports_id: apiSportsId
          })
          .select('id')
          .single();

        if (compInsertErr) throw compInsertErr;
        competitionId = newComp.id;
      }

      // 2. Asegurar que exista la Temporada (Season)
      let seasonId: number;
      const { data: seasonData, error: seasonGetErr } = await supabase
        .from('seasons')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('year_start', yearStart)
        .eq('year_end', yearEnd)
        .maybeSingle();

      if (seasonGetErr) throw seasonGetErr;

      if (seasonData) {
        seasonId = seasonData.id;
      } else {
        const { data: newSeason, error: seasonInsertErr } = await supabase
          .from('seasons')
          .insert({
            competition_id: competitionId,
            year_start: yearStart,
            year_end: yearEnd,
          })
          .select('id')
          .single();

        if (seasonInsertErr) throw seasonInsertErr;
        seasonId = newSeason.id;
      }

      // 3. Parsear marcadores e identificar si es partido único
      const [scoreHome1, scoreAway1] = firstLeg.split('-').map(Number);
      if (isNaN(scoreHome1) || isNaN(scoreAway1)) {
        return NextResponse.json({ success: false, error: 'Marcador de goles del primer partido/único inválido.' }, { status: 400 });
      }

      const isSingleLeg = !secondLeg || secondLeg.trim() === '' || secondLeg.trim() === '-';
      let scoreA_2 = NaN;
      let scoreB_2 = NaN;

      if (!isSingleLeg) {
        const parts = secondLeg.split('-').map(Number);
        scoreA_2 = parts[0]; // Primer valor es del Equipo A (visitante en vuelta)
        scoreB_2 = parts[1]; // Segundo valor es del Equipo B (local en vuelta)
        if (isNaN(scoreB_2) || isNaN(scoreA_2)) {
          return NextResponse.json({ success: false, error: 'Marcador de goles del segundo partido inválido.' }, { status: 400 });
        }
      }

      // Tanda de penaltis o desempate
      let penaltyHome1: number | null = null;
      let penaltyAway1: number | null = null;
      let penaltyHome2: number | null = null;
      let penaltyAway2: number | null = null;

      let playoffHome: number | null = null;
      let playoffAway: number | null = null;

      const isPlayoffMatch = yearStart < 1970 && agg && agg.includes('-');

      if (agg && agg.includes('-')) {
        const [scoreA, scoreB] = agg.split('-').map(Number);
        if (!isNaN(scoreA) && !isNaN(scoreB)) {
          if (isPlayoffMatch) {
            playoffHome = scoreA;
            playoffAway = scoreB;
          } else {
            if (isSingleLeg) {
              penaltyHome1 = scoreA; // Team A local en partido único
              penaltyAway1 = scoreB; // Team B visitante en partido único
            } else {
              penaltyHome2 = scoreB; // Team B local en vuelta
              penaltyAway2 = scoreA; // Team A visitante en vuelta
            }
          }
        }
      }

      // Detectar automáticamente si es campo neutral (Finales o Supercopa)
      // Si el partido es de ida y vuelta (dos partidos), no debe considerarse neutral.
      const isNeutral =
        isSingleLeg &&
        (instance.toLowerCase().trim() === 'final' ||
          instance.toLowerCase().trim() === 'f' ||
          competition.toUpperCase().trim() === 'sc');

      // 4. Buscar / Insertar Partido de Ida (o Partido Único) si no existe
      let match1 = null;
      const { data: existingMatch1, error: check1Err } = await supabase
        .from('matches')
        .select()
        .eq('season_id', seasonId)
        .eq('home_team_id', Number(teamA_id))
        .eq('away_team_id', Number(teamB_id))
        .eq('is_leg1', true)
        .eq('round', instance)
        .maybeSingle();

      if (check1Err) throw check1Err;

      if (existingMatch1) {
        match1 = existingMatch1;
      } else {
        const { data: newMatch1, error: match1Err } = await supabase
          .from('matches')
          .insert({
            season_id: seasonId,
            home_team_id: Number(teamA_id),
            away_team_id: Number(teamB_id),
            home_goals: scoreHome1,
            away_goals: scoreAway1,
            is_leg1: true,
            round: instance,
            penalty_home_goals: penaltyHome1,
            penalty_away_goals: penaltyAway1,
            is_neutral: isNeutral,
          })
          .select()
          .single();

        if (match1Err) throw match1Err;
        match1 = newMatch1;
      }

      // 5. Buscar / Insertar Partido de Vuelta si no existe
      let match2 = null;
      if (!isSingleLeg) {
        const { data: existingMatch2, error: check2Err } = await supabase
          .from('matches')
          .select()
          .eq('season_id', seasonId)
          .eq('home_team_id', Number(teamB_id))
          .eq('away_team_id', Number(teamA_id))
          .eq('is_leg1', false)
          .eq('round', instance)
          .maybeSingle();

        if (check2Err) throw check2Err;

        if (existingMatch2) {
          match2 = existingMatch2;
        } else {
          const { data: newMatch2, error: match2Err } = await supabase
            .from('matches')
            .insert({
              season_id: seasonId,
              home_team_id: Number(teamB_id),
              away_team_id: Number(teamA_id),
              home_goals: scoreB_2,
              away_goals: scoreA_2,
              is_leg1: false,
              round: instance,
              penalty_home_goals: penaltyHome2,
              penalty_away_goals: penaltyAway2,
              is_neutral: isNeutral,
            })
            .select()
            .single();

          if (match2Err) throw match2Err;
          match2 = newMatch2;
        }
      }

      // 6. Buscar / Insertar Partido de Desempate (Playoff) si no existe
      let matchPlayoff = null;
      if (isPlayoffMatch) {
        const { data: existingPlayoff, error: checkPlayoffErr } = await supabase
          .from('matches')
          .select()
          .eq('season_id', seasonId)
          .eq('home_team_id', Number(teamA_id))
          .eq('away_team_id', Number(teamB_id))
          .eq('round', `${instance} (Desempate)`)
          .maybeSingle();

        if (checkPlayoffErr) throw checkPlayoffErr;

        if (existingPlayoff) {
          matchPlayoff = existingPlayoff;
        } else {
          const { data: mPlayoff, error: playoffErr } = await supabase
            .from('matches')
            .insert({
              season_id: seasonId,
              home_team_id: Number(teamA_id),
              away_team_id: Number(teamB_id),
              home_goals: playoffHome,
              away_goals: playoffAway,
              is_leg1: false,
              round: `${instance} (Desempate)`,
              is_neutral: true, // Campo neutral para desempates
            })
            .select()
            .single();

          if (playoffErr) throw playoffErr;
          matchPlayoff = mPlayoff;
        }
      }

      return NextResponse.json({
        success: true,
        match1,
        match2,
        matchPlayoff,
      });
    }

    // --- ACCIÓN: IMPORTAR TÍTULOS ---
    if (action === 'import-titles') {
      const {
        year,
        competition,
        teamA_id,
        teamB_id,
        firstLeg,
        secondLeg,
        agg,
      } = body;

      if (!year || !competition || !teamA_id || !teamB_id || !firstLeg) {
        return NextResponse.json({ success: false, error: 'Faltan campos obligatorios para importar los títulos.' }, { status: 400 });
      }

      // Parseamos los años (ej: "2024/25" o "2024-25" -> year_start: 2024, year_end: 2025)
      const separator = year.includes('/') ? '/' : '-';
      const parts = year.split(separator);
      const yearStart = parseInt(parts[0]);
      let yearEnd = yearStart + 1;
      if (parts[1]) {
        const endPart = parseInt(parts[1]);
        yearEnd = endPart < 100 ? Math.floor(yearStart / 100) * 100 + endPart : endPart;
      }

      const mappedCompName = getCompetitionFullName(competition, yearStart);

      // 1. Asegurar que exista la Competición en Supabase
      let competitionId: number;
      const { data: compData, error: compGetErr } = await supabase
        .from('competitions')
        .select('id')
        .ilike('name', mappedCompName)
        .maybeSingle();

      if (compGetErr) {
        return NextResponse.json({
          success: false,
          error: 'Error consultando la tabla Competitions. Asegúrate de ejecutar el script SQL de las tablas 5 a 9 en Supabase.'
        }, { status: 400 });
      }

      if (compData) {
        competitionId = compData.id;
      } else {
        let apiSportsId: number | null = null;
        if (mappedCompName === 'UEFA Champions League') apiSportsId = 3;
        else if (mappedCompName === 'UEFA Europa League') apiSportsId = 4;
        else if (mappedCompName === 'UEFA Europa Conference League') apiSportsId = 683;

        const { data: newComp, error: compInsertErr } = await supabase
          .from('competitions')
          .insert({
            name: mappedCompName,
            type: 'international',
            api_sports_id: apiSportsId
          })
          .select('id')
          .single();

        if (compInsertErr) throw compInsertErr;
        competitionId = newComp.id;
      }

      // 2. Asegurar que exista la Temporada (Season)
      let seasonId: number;
      const { data: seasonData, error: seasonGetErr } = await supabase
        .from('seasons')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('year_start', yearStart)
        .eq('year_end', yearEnd)
        .maybeSingle();

      if (seasonGetErr) throw seasonGetErr;

      if (seasonData) {
        seasonId = seasonData.id;
      } else {
        const { data: newSeason, error: seasonInsertErr } = await supabase
          .from('seasons')
          .insert({
            competition_id: competitionId,
            year_start: yearStart,
            year_end: yearEnd,
          })
          .select('id')
          .single();

        if (seasonInsertErr) throw seasonInsertErr;
        seasonId = newSeason.id;
      }

      // 3. Determinar quién es el Campeón y quién el Subcampeón
      const winnerResult = determineWinnerAndLoser({ year, firstLeg, secondLeg, agg });
      if (!winnerResult) {
        return NextResponse.json({ success: false, error: 'No se pudo determinar el ganador de la final.' }, { status: 400 });
      }

      const championTeamId = winnerResult.winner === 'A' ? Number(teamA_id) : Number(teamB_id);
      const runnerupTeamId = winnerResult.winner === 'A' ? Number(teamB_id) : Number(teamA_id);

      // 4. Guardar en la tabla de Títulos (usando upserts o insertando)
      // Primero limpiamos posibles registros previos para esta temporada y competición
      await supabase
        .from('titles')
        .delete()
        .eq('season_id', seasonId);

      // Insertamos el campeón
      const { error: champErr } = await supabase
        .from('titles')
        .insert({
          team_id: championTeamId,
          competition_id: competitionId,
          season_id: seasonId,
          title_name: 'champion',
        });

      if (champErr) throw champErr;

      // Insertamos el subcampeón
      const { error: runnerErr } = await supabase
        .from('titles')
        .insert({
          team_id: runnerupTeamId,
          competition_id: competitionId,
          season_id: seasonId,
          title_name: 'runner-up',
        });

      if (runnerErr) throw runnerErr;

      return NextResponse.json({
        success: true,
        champion_id: championTeamId,
        runner_up_id: runnerupTeamId,
      });
    }

    // --- ACCIÓN: ALTERNAR CONDICIÓN NEUTRAL ---
    if (action === 'toggle-neutral') {
      const { id, is_neutral } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Falta el ID del partido' }, { status: 400 });
      }

      const { error: updateErr } = await supabase
        .from('matches')
        .update({ is_neutral: Boolean(is_neutral) })
        .eq('id', id);

      if (updateErr) throw updateErr;

      return NextResponse.json({ success: true });
    }

    // --- ACCIÓN: ELIMINAR PARTIDO ---
    if (action === 'delete-match') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Falta el ID del partido' }, { status: 400 });
      }

      const { error: deleteErr } = await supabase
        .from('matches')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error en post API importer:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
  }
}
