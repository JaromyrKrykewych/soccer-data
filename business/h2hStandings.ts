export interface TeamBasic {
  id: number;
  current_name: string;
  countries?: {
    id?: number;
    name: string;
  } | null;
}

export interface MatchBasic {
  id?: number;
  home_team_id: number;
  away_team_id: number;
  home_goals: number;
  away_goals: number;
}

export interface H2HDuelDetail {
  opponent: TeamBasic;
  wins: number;      // Victorias de este equipo frente al rival (GF en este duelo)
  losses: number;    // Victorias del rival frente a este equipo (GC en este duelo)
  draws: number;     // Empates reales en el historial
  totalMatches: number;
  outcome: 'W' | 'D' | 'L'; // Resultado del super-duelo: Victoria, Empate, Derrota
}

export interface H2HStandingRow {
  team: TeamBasic;
  pj: number;   // Duelos disputados (rivales con los que jugó)
  pg: number;   // Duelos ganados (más victorias directas que el rival)
  pe: number;   // Duelos empatados (igual cantidad de victorias directas)
  pp: number;   // Duelos perdidos (menos victorias directas que el rival)
  gf: number;   // Goles a favor (total de victorias directas conseguidas)
  gc: number;   // Goles en contra (total de victorias del rival)
  dg: number;   // Diferencia de victorias (gf - gc)
  pts: number;  // Puntos: (pg * 3) + pe
  totalRealMatches: number; // Partidos reales disputados en total
  duels: H2HDuelDetail[];
}

/**
 * Calcula la tabla de posiciones basada en el historial directo (H2H).
 * La unidad de cómputo es el duelo entre pares de equipos (A vs B).
 * Las victorias directas actúan como los goles de cada equipo.
 *
 * @param teams Lista de equipos a evaluar (o todos los equipos)
 * @param matches Lista de partidos de la base de datos
 * @param filterTeamIds Opcional: si se pasa un Set de IDs, solo se toman partidos entre ellos
 */
export function computeH2HStandings(
  teams: TeamBasic[],
  matches: MatchBasic[],
  filterTeamIds?: Set<number>
): H2HStandingRow[] {
  const teamsMap = new Map<number, TeamBasic>();
  const standingsMap = new Map<number, H2HStandingRow>();

  teams.forEach((t) => {
    if (!filterTeamIds || filterTeamIds.has(t.id)) {
      teamsMap.set(t.id, t);
      standingsMap.set(t.id, {
        team: t,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        dg: 0,
        pts: 0,
        totalRealMatches: 0,
        duels: [],
      });
    }
  });

  // Agrupamos victorias por par de equipos (clave "minId_maxId")
  const pairStats = new Map<
    string,
    {
      teamAId: number;
      teamBId: number;
      winsA: number;
      winsB: number;
      draws: number;
      total: number;
    }
  >();

  matches.forEach((m) => {
    const homeIn = teamsMap.has(m.home_team_id);
    const awayIn = teamsMap.has(m.away_team_id);

    // Solo procesamos si ambos equipos forman parte del universo evaluado
    if (!homeIn || !awayIn) return;

    const idA = Math.min(m.home_team_id, m.away_team_id);
    const idB = Math.max(m.home_team_id, m.away_team_id);
    const key = `${idA}_${idB}`;

    let stat = pairStats.get(key);
    if (!stat) {
      stat = {
        teamAId: idA,
        teamBId: idB,
        winsA: 0,
        winsB: 0,
        draws: 0,
        total: 0,
      };
      pairStats.set(key, stat);
    }

    stat.total++;
    if (m.home_goals > m.away_goals) {
      if (m.home_team_id === idA) stat.winsA++;
      else stat.winsB++;
    } else if (m.away_goals > m.home_goals) {
      if (m.away_team_id === idA) stat.winsA++;
      else stat.winsB++;
    } else {
      stat.draws++;
    }
  });

  // Recorremos los pares que efectivamente disputaron partidos (matriz dispersa)
  pairStats.forEach((stat) => {
    if (stat.total === 0) return;

    const rowA = standingsMap.get(stat.teamAId);
    const rowB = standingsMap.get(stat.teamBId);
    if (!rowA || !rowB) return;

    const goalsA = stat.winsA;
    const goalsB = stat.winsB;

    rowA.pj += 1;
    rowB.pj += 1;
    rowA.gf += goalsA;
    rowA.gc += goalsB;
    rowB.gf += goalsB;
    rowB.gc += goalsA;
    rowA.totalRealMatches += stat.total;
    rowB.totalRealMatches += stat.total;

    let outcomeA: 'W' | 'D' | 'L' = 'D';
    let outcomeB: 'W' | 'D' | 'L' = 'D';

    if (goalsA > goalsB) {
      rowA.pg += 1;
      rowA.pts += 3;
      rowB.pp += 1;
      outcomeA = 'W';
      outcomeB = 'L';
    } else if (goalsB > goalsA) {
      rowB.pg += 1;
      rowB.pts += 3;
      rowA.pp += 1;
      outcomeA = 'L';
      outcomeB = 'W';
    } else {
      // Empate (0-0 por empates o 1-1, 2-2, etc por igual número de victorias)
      rowA.pe += 1;
      rowA.pts += 1;
      rowB.pe += 1;
      rowB.pts += 1;
      outcomeA = 'D';
      outcomeB = 'D';
    }

    rowA.duels.push({
      opponent: rowB.team,
      wins: goalsA,
      losses: goalsB,
      draws: stat.draws,
      totalMatches: stat.total,
      outcome: outcomeA,
    });

    rowB.duels.push({
      opponent: rowA.team,
      wins: goalsB,
      losses: goalsA,
      draws: stat.draws,
      totalMatches: stat.total,
      outcome: outcomeB,
    });
  });

  // Ordenar los duelos internos de cada equipo por mayor número de partidos disputados
  standingsMap.forEach((row) => {
    row.dg = row.gf - row.gc;
    row.duels.sort((a, b) => {
      if (b.totalMatches !== a.totalMatches) return b.totalMatches - a.totalMatches;
      return a.opponent.current_name.localeCompare(b.opponent.current_name);
    });
  });

  // Ordenar la tabla de posiciones con criterios oficiales
  return Array.from(standingsMap.values()).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts; // 1° Puntos
    if (b.dg !== a.dg) return b.dg - a.dg;     // 2° Diferencia de victorias
    if (b.gf !== a.gf) return b.gf - a.gf;     // 3° Victorias a favor (Goles)
    if (b.pg !== a.pg) return b.pg - a.pg;     // 4° Duelos ganados
    if (b.pj !== a.pj) return b.pj - a.pj;     // 5° Mayor cantidad de duelos disputados
    return a.team.current_name.localeCompare(b.team.current_name);
  });
}
