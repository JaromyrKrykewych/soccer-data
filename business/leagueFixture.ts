export interface FixtureTeam {
  id: number;
  current_name: string;
  countries: {
    id: number;
    name: string;
  } | null;
}

export interface FixtureMatchData {
  home_team_id: number;
  away_team_id: number;
  is_neutral: boolean;
}

export interface ScheduledMatch {
  round: number; // 1-based
  home: FixtureTeam;
  away: FixtureTeam;
  h2hCount: number;
  homeHasLocalHistory: boolean;
  awayHasLocalHistory: boolean;
}

export interface ScheduledRound {
  round: number; // 1-based
  matches: ScheduledMatch[];
  byeTeam: FixtureTeam | null;
  noH2hCount: number;
}

export interface LeagueFixtureResult {
  rounds: ScheduledRound[];
  totalMatches: number;
  totalNoH2hMatches: number;
  firstNoH2hRound: number | null;
}

function getPairKey(idA: number, idB: number): string {
  return idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
}

/**
 * Generates an initial valid 1-factorization (single round-robin)
 * using the standard circle method for an even number of slots `m`.
 * Each round is stored as an Int16Array where `round[u] = v` means `u` plays `v`.
 */
function buildCircleRounds(order: number[]): Int16Array[] {
  const m = order.length;
  const numRounds = m - 1;
  const rounds: Int16Array[] = [];
  const rotating = order.slice(1);

  for (let r = 0; r < numRounds; r++) {
    const partner = new Int16Array(m);
    const fixed = order[0];
    const opp = rotating[0];
    partner[fixed] = opp;
    partner[opp] = fixed;

    const half = m / 2;
    for (let i = 1; i < half; i++) {
      const a = rotating[i];
      const b = rotating[m - 1 - i];
      partner[a] = b;
      partner[b] = a;
    }

    rounds.push(partner);

    // Rotate clockwise
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  return rounds;
}

function countRoundNoH2h(partner: Int16Array, isNoH2h: Uint8Array[], m: number): number {
  let count = 0;
  for (let u = 0; u < m; u++) {
    const v = partner[u];
    if (u < v && isNoH2h[u][v]) {
      count++;
    }
  }
  return count;
}

function scoreSchedule(roundNoH2hCounts: number[]): number {
  const R = roundNoH2hCounts.length;
  let score = 0;
  for (let r = 0; r < R; r++) {
    const weight = R - r;
    score += roundNoH2hCounts[r] * weight * weight;
  }
  return score;
}

function sortRoundsByNoH2h(rounds: Int16Array[], counts: number[]): void {
  const indices = rounds.map((_, i) => i);
  indices.sort((a, b) => counts[a] - counts[b]);
  const sortedRounds = indices.map((i) => rounds[i]);
  const sortedCounts = indices.map((i) => counts[i]);
  for (let i = 0; i < rounds.length; i++) {
    rounds[i] = sortedRounds[i];
    counts[i] = sortedCounts[i];
  }
}

/**
 * Helper to walk the alternating cycle of `rounds[r1]` and `rounds[r2]` starting at `u`.
 */
function traceAlternatingCycle(
  round1: Int16Array,
  round2: Int16Array,
  start: number,
  isNoH2h: Uint8Array[],
  visited: Uint8Array
): { c1: number; c2: number; r1Edges: [number, number][]; r2Edges: [number, number][] } {
  visited.fill(0);
  let curr = start;
  let c1 = 0;
  let c2 = 0;
  const r1Edges: [number, number][] = [];
  const r2Edges: [number, number][] = [];

  while (!visited[curr]) {
    visited[curr] = 1;
    const next = round1[curr];
    r1Edges.push([curr, next]);
    if (isNoH2h[curr][next]) c1++;

    const after = round2[next];
    r2Edges.push([next, after]);
    if (isNoH2h[next][after]) c2++;

    curr = after;
  }

  return { c1, c2, r1Edges, r2Edges };
}

function applyCycleSwap(
  round1: Int16Array,
  round2: Int16Array,
  r1Edges: [number, number][],
  r2Edges: [number, number][]
): void {
  for (let i = 0; i < r1Edges.length; i++) {
    const [a, b] = r1Edges[i];
    round2[a] = b;
    round2[b] = a;
  }
  for (let i = 0; i < r2Edges.length; i++) {
    const [a, b] = r2Edges[i];
    round1[a] = b;
    round1[b] = a;
  }
}

/**
 * Optimizes a valid round-robin schedule using 2-round Kempe-chain (alternating cycle) swaps
 * with plateau cycle-breaking moves so that `NO PJ` (no H2H history) matches are concentrated
 * as far toward the final rounds as possible.
 * Every swap preserves the exact single round-robin invariant.
 */
function optimizeRoundsKempe(rounds: Int16Array[], isNoH2h: Uint8Array[], m: number): number[] {
  const R = rounds.length;
  const counts = rounds.map((r) => countRoundNoH2h(r, isNoH2h, m));
  sortRoundsByNoH2h(rounds, counts);

  const visited = new Uint8Array(m);

  const runGreedyDescent = () => {
    for (let pass = 0; pass < 30; pass++) {
      let improved = false;

      for (let r1 = 0; r1 < R - 1; r1++) {
        if (counts[r1] === 0) continue;

        for (let u = 0; u < m; u++) {
          const v = rounds[r1][u];
          if (u >= v || !isNoH2h[u][v]) continue;

          // Find the best later round r2 > r1 that strictly moves NO PJ edges from r1 to r2
          let bestR2 = -1;
          let bestDelta = 0;
          let bestCycle: { r1Edges: [number, number][]; r2Edges: [number, number][] } | null = null;

          for (let r2 = R - 1; r2 > r1; r2--) {
            const cycle = traceAlternatingCycle(rounds[r1], rounds[r2], u, isNoH2h, visited);
            const delta = cycle.c1 - cycle.c2;
            if (delta > bestDelta) {
              bestDelta = delta;
              bestR2 = r2;
              bestCycle = cycle;
              // Fast exit if we found a clean single-edge push into the very last rounds
              if (cycle.c2 === 0 && delta >= 1 && r2 >= R - 3) break;
            }
          }

          if (bestR2 !== -1 && bestCycle) {
            applyCycleSwap(rounds[r1], rounds[bestR2], bestCycle.r1Edges, bestCycle.r2Edges);
            counts[r1] -= bestDelta;
            counts[bestR2] += bestDelta;
            improved = true;
          }
        }
      }

      sortRoundsByNoH2h(rounds, counts);
      if (!improved) break;
    }
  };

  runGreedyDescent();

  // Plateau cycle-breaking: swap neutral (c1 === c2) cycles on early NO PJ rounds
  // to break long alternating cycles and unlock further greedy improvements.
  const plateauIterations = 12;
  for (let iter = 0; iter < plateauIterations; iter++) {
    // Find earliest round that still has NO PJ matches
    let firstDirty = -1;
    for (let r = 0; r < R - 1; r++) {
      if (counts[r] > 0) {
        firstDirty = r;
        break;
      }
    }
    if (firstDirty === -1) break;

    let perturbed = false;
    // Try a few neutral swaps across early dirty rounds to reshape cycles
    const endDirty = Math.min(R - 2, firstDirty + 5);
    for (let r1 = firstDirty; r1 <= endDirty; r1++) {
      if (counts[r1] === 0) continue;
      for (let u = 0; u < m; u++) {
        const v = rounds[r1][u];
        if (u >= v || !isNoH2h[u][v]) continue;

        const r2 = r1 + 1 + Math.floor(Math.random() * (R - 1 - r1));
        const cycle = traceAlternatingCycle(rounds[r1], rounds[r2], u, isNoH2h, visited);
        // Only apply if it doesn't worsen the schedule (c1 >= c2) and isn't the whole graph
        if (cycle.c1 >= cycle.c2 && cycle.r1Edges.length * 2 < m) {
          applyCycleSwap(rounds[r1], rounds[r2], cycle.r1Edges, cycle.r2Edges);
          const delta = cycle.c1 - cycle.c2;
          counts[r1] -= delta;
          counts[r2] += delta;
          perturbed = true;
          break;
        }
      }
    }

    if (!perturbed) break;
    runGreedyDescent();
  }

  return counts;
}

function shuffleArray(arr: number[]): number[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Generates a single round-robin league fixture for `teams`:
 * - Every pair of teams plays exactly once.
 * - If `teams.length` is odd, one team has a BYE ("Fecha Libre") each round.
 * - Matches with no H2H history (`NO PJ`) are pushed as far toward the final rounds as possible.
 * - Home/Away assignment prioritizes the team that has non-neutral home matches in the H2H history,
 *   then balances total home games across the tournament.
 */
export function generateSingleRoundRobinFixture(
  teams: FixtureTeam[],
  h2hMatchesDict: Map<string, FixtureMatchData[]>
): LeagueFixtureResult {
  const n = teams.length;
  if (n < 2) {
    return {
      rounds: [],
      totalMatches: 0,
      totalNoH2hMatches: 0,
      firstNoH2hRound: null,
    };
  }

  const hasBye = n % 2 === 1;
  const m = hasBye ? n + 1 : n;
  const byeSlot = hasBye ? n : -1;

  // Precompute H2H adjacency matrices
  const isNoH2h: Uint8Array[] = Array.from({ length: m }, () => new Uint8Array(m));
  const h2hCounts: Uint16Array[] = Array.from({ length: n }, () => new Uint16Array(n));
  const hasHomeHistory: Uint8Array[] = Array.from({ length: n }, () => new Uint8Array(n));

  let totalNoH2hMatches = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const teamA = teams[i];
      const teamB = teams[j];
      const matches = h2hMatchesDict.get(getPairKey(teamA.id, teamB.id)) || [];

      if (matches.length === 0) {
        isNoH2h[i][j] = 1;
        isNoH2h[j][i] = 1;
        totalNoH2hMatches++;
      } else {
        h2hCounts[i][j] = matches.length;
        h2hCounts[j][i] = matches.length;

        let aHome = false;
        let bHome = false;
        for (let k = 0; k < matches.length; k++) {
          const match = matches[k];
          if (match.is_neutral) continue;
          if (match.home_team_id === teamA.id) aHome = true;
          else if (match.home_team_id === teamB.id) bHome = true;
          if (aHome && bHome) break;
        }
        hasHomeHistory[i][j] = aHome ? 1 : 0;
        hasHomeHistory[j][i] = bHome ? 1 : 0;
      }
    }
  }

  // Multi-start optimization: pick the best schedule across 6 starting permutations
  const baseOrder = Array.from({ length: m }, (_, i) => i);
  const restarts = totalNoH2hMatches === 0 ? 1 : 6;

  let bestRounds: Int16Array[] = [];
  let bestCounts: number[] = [];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < restarts; attempt++) {
    const order = attempt === 0 ? baseOrder : shuffleArray(baseOrder);
    const candidateRounds = buildCircleRounds(order);
    const candidateCounts =
      totalNoH2hMatches === 0
        ? candidateRounds.map(() => 0)
        : optimizeRoundsKempe(candidateRounds, isNoH2h, m);
    const candidateScore = scoreSchedule(candidateCounts);

    if (candidateScore < bestScore) {
      bestScore = candidateScore;
      bestRounds = candidateRounds;
      bestCounts = candidateCounts;
      if (candidateScore === 0) break;
    }
  }

  // Assign Home/Away in two passes:
  // Pass 1: Lock pairs where exactly one team has local H2H history
  const homeCount = new Int32Array(n);
  const pairHomeChoice = new Map<string, number>(); // "min_max" -> chosen home team index

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const aHome = hasHomeHistory[i][j] === 1;
      const bHome = hasHomeHistory[j][i] === 1;
      if (aHome && !bHome) {
        pairHomeChoice.set(`${i}_${j}`, i);
        homeCount[i]++;
      } else if (!aHome && bHome) {
        pairHomeChoice.set(`${i}_${j}`, j);
        homeCount[j]++;
      }
    }
  }

  // Pass 2: Balance remaining pairs across rounds
  const scheduledRounds: ScheduledRound[] = [];
  let firstNoH2hRound: number | null = null;
  let totalMatches = 0;

  for (let r = 0; r < bestRounds.length; r++) {
    const partner = bestRounds[r];
    const roundNum = r + 1;
    const matches: ScheduledMatch[] = [];
    let byeTeam: FixtureTeam | null = null;

    for (let u = 0; u < m; u++) {
      const v = partner[u];
      if (u >= v) continue;

      if (u === byeSlot || v === byeSlot) {
        const realIdx = u === byeSlot ? v : u;
        byeTeam = teams[realIdx];
        continue;
      }

      const key = `${u}_${v}`;
      let homeIdx = pairHomeChoice.get(key);
      if (homeIdx === undefined) {
        if (homeCount[u] < homeCount[v]) {
          homeIdx = u;
        } else if (homeCount[v] < homeCount[u]) {
          homeIdx = v;
        } else {
          homeIdx = (r + u + v) % 2 === 0 ? u : v;
        }
        homeCount[homeIdx]++;
      }

      const awayIdx = homeIdx === u ? v : u;
      matches.push({
        round: roundNum,
        home: teams[homeIdx],
        away: teams[awayIdx],
        h2hCount: h2hCounts[homeIdx][awayIdx],
        homeHasLocalHistory: hasHomeHistory[homeIdx][awayIdx] === 1,
        awayHasLocalHistory: hasHomeHistory[awayIdx][homeIdx] === 1,
      });
      totalMatches++;
    }

    // Order matches inside the round: H2H matches first, NO PJ matches at the bottom of the round
    matches.sort((a, b) => {
      if (a.h2hCount === 0 && b.h2hCount > 0) return 1;
      if (a.h2hCount > 0 && b.h2hCount === 0) return -1;
      return b.h2hCount - a.h2hCount;
    });

    const noH2hCount = bestCounts[r];
    if (noH2hCount > 0 && firstNoH2hRound === null) {
      firstNoH2hRound = roundNum;
    }

    scheduledRounds.push({
      round: roundNum,
      matches,
      byeTeam,
      noH2hCount,
    });
  }

  return {
    rounds: scheduledRounds,
    totalMatches,
    totalNoH2hMatches,
    firstNoH2hRound,
  };
}

/**
 * Exports the generated league fixture to an .xlsx file compatible with
 * both Microsoft Excel and Google Sheets (including formulas for the Standings sheet).
 */
export async function exportLeagueFixtureToXlsx(
  teams: FixtureTeam[],
  fixture: LeagueFixtureResult,
  fileNameBase: string
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Soccer Data - Comparador Histórico';
  workbook.created = new Date();

  // =========================================================================
  // SHEET 1: Fixture
  // =========================================================================
  const fixtureSheet = workbook.addWorksheet('Fixture', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  fixtureSheet.columns = [
    { header: 'Jornada', key: 'round', width: 11 },
    { header: 'Local', key: 'home', width: 28 },
    { header: 'Visitante', key: 'away', width: 28 },
    { header: 'Goles L', key: 'goalsHome', width: 11 },
    { header: 'Goles V', key: 'goalsAway', width: 11 },
    { header: 'Historial H2H', key: 'h2h', width: 22 },
  ];

  // Style header row
  const fixtureHeader = fixtureSheet.getRow(1);
  fixtureHeader.height = 24;
  fixtureHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFEC4899' } },
    };
  });

  fixture.rounds.forEach((roundObj, roundIdx) => {
    const isEvenRound = roundIdx % 2 === 0;
    const baseFill = isEvenRound ? 'FFFFFFFF' : 'FFF8FAFC';

    roundObj.matches.forEach((match) => {
      const h2hLabel =
        match.h2hCount === 0
          ? 'Sin H2H'
          : match.homeHasLocalHistory
            ? `${match.h2hCount} PJ (Local OK)`
            : `${match.h2hCount} PJ (Sin local)`;

      const row = fixtureSheet.addRow({
        round: roundObj.round,
        home: match.home.current_name,
        away: match.away.current_name,
        goalsHome: null,
        goalsAway: null,
        h2h: h2hLabel,
      });

      const fillArgb = match.h2hCount === 0 ? 'FFFFF7ED' : baseFill;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillArgb },
        };
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
        if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
        if (colNumber === 6 && match.h2hCount === 0) {
          cell.font = { color: { argb: 'FFC2410C' }, bold: true, size: 10 };
        } else if (colNumber === 6) {
          cell.font = { color: { argb: 'FF475569' }, size: 10 };
        }
      });
    });

    if (roundObj.byeTeam) {
      const byeRow = fixtureSheet.addRow({
        round: roundObj.round,
        home: roundObj.byeTeam.current_name,
        away: 'FECHA LIBRE',
        goalsHome: null,
        goalsAway: null,
        h2h: 'Libre',
      });
      byeRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
        cell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
        if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    } else if (fixtureSheet.lastRow) {
      // Subtle bottom border to separate rounds visually
      fixtureSheet.lastRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          ...cell.border,
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });
    }
  });

  const lastFixtureRow = fixtureSheet.rowCount;
  fixtureSheet.autoFilter = `A1:F${lastFixtureRow}`;

  // =========================================================================
  // SHEET 2: Tabla de Posiciones (Excel & Google Sheets compatible formulas)
  // =========================================================================
  const standingsSheet = workbook.addWorksheet('Tabla de Posiciones', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  standingsSheet.columns = [
    { header: 'P°', key: 'pos', width: 7 },
    { header: 'Equipo', key: 'team', width: 28 },
    { header: 'País', key: 'country', width: 20 },
    { header: 'PJ', key: 'pj', width: 8 },
    { header: 'PG', key: 'pg', width: 8 },
    { header: 'PE', key: 'pe', width: 8 },
    { header: 'PP', key: 'pp', width: 8 },
    { header: 'GF', key: 'gf', width: 8 },
    { header: 'GC', key: 'gc', width: 8 },
    { header: 'DG', key: 'dg', width: 8 },
    { header: 'PTS', key: 'pts', width: 10 },
  ];

  const standingsHeader = standingsSheet.getRow(1);
  standingsHeader.height = 24;
  standingsHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFEC4899' } },
    };
  });

  const B = `Fixture!$B$2:$B$${lastFixtureRow}`;
  const C = `Fixture!$C$2:$C$${lastFixtureRow}`;
  const D = `Fixture!$D$2:$D$${lastFixtureRow}`;
  const E = `Fixture!$E$2:$E$${lastFixtureRow}`;

  teams.forEach((team, idx) => {
    const r = idx + 2;
    const row = standingsSheet.addRow({
      pos: idx + 1,
      team: team.current_name,
      country: team.countries?.name || 'Desconocido',
      pj: { formula: `E${r}+F${r}+G${r}`, result: 0 },
      pg: {
        formula: `SUMPRODUCT((${B}=B${r})*(${D}<>"")*(${E}<>"")*(${D}>${E}))+SUMPRODUCT((${C}=B${r})*(${D}<>"")*(${E}<>"")*(${E}>${D}))`,
        result: 0,
      },
      pe: {
        formula: `SUMPRODUCT(((${B}=B${r})+(${C}=B${r}))*(${D}<>"")*(${E}<>"")*(${D}=${E}))`,
        result: 0,
      },
      pp: {
        formula: `SUMPRODUCT((${B}=B${r})*(${D}<>"")*(${E}<>"")*(${D}<${E}))+SUMPRODUCT((${C}=B${r})*(${D}<>"")*(${E}<>"")*(${E}<${D}))`,
        result: 0,
      },
      gf: {
        formula: `SUMIFS(${D},${B},B${r},${D},">=0",${E},">=0")+SUMIFS(${E},${C},B${r},${D},">=0",${E},">=0")`,
        result: 0,
      },
      gc: {
        formula: `SUMIFS(${E},${B},B${r},${D},">=0",${E},">=0")+SUMIFS(${D},${C},B${r},${D},">=0",${E},">=0")`,
        result: 0,
      },
      dg: { formula: `H${r}-I${r}`, result: 0 },
      pts: { formula: `E${r}*3+F${r}`, result: 0 },
    });

    const isZebra = idx % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isZebra ? 'FFF8FAFC' : 'FFFFFFFF' },
      };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
      };
      if (colNumber === 1 || colNumber >= 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
      if (colNumber === 1) {
        cell.font = { bold: true, color: { argb: 'FF64748B' } };
      } else if (colNumber === 11) {
        cell.font = { bold: true, color: { argb: 'FF0F172A' } };
      }
    });
  });

  // AutoFilter excludes column A (P°) so position numbers stay fixed when sorting
  standingsSheet.autoFilter = `B1:K${teams.length + 1}`;

  // =========================================================================
  // SHEET 3: Posiciones Ordenadas (Auto-sorted PTS > DG > GF for Google Sheets)
  // =========================================================================
  const sortedSheet = workbook.addWorksheet('Posiciones Ordenadas', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sortedSheet.columns = [
    { header: 'P°', key: 'pos', width: 7 },
    { header: 'Equipo', key: 'team', width: 28 },
    { header: 'País', key: 'country', width: 20 },
    { header: 'PJ', key: 'pj', width: 8 },
    { header: 'PG', key: 'pg', width: 8 },
    { header: 'PE', key: 'pe', width: 8 },
    { header: 'PP', key: 'pp', width: 8 },
    { header: 'GF', key: 'gf', width: 8 },
    { header: 'GC', key: 'gc', width: 8 },
    { header: 'DG', key: 'dg', width: 8 },
    { header: 'PTS', key: 'pts', width: 10 },
  ];

  const sortedHeader = sortedSheet.getRow(1);
  sortedHeader.height = 24;
  sortedHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF10B981' } },
    };
  });

  const lastStandingsRow = teams.length + 1;

  // Populate static Pos column (1..N) and apply table formatting without values in B2:K{N+1}
  // so Google Sheets' SORT formula in B2 spills cleanly into B2:K{N+1}.
  for (let idx = 0; idx < teams.length; idx++) {
    const r = idx + 2;
    const row = sortedSheet.getRow(r);
    const posCell = row.getCell(1);
    posCell.value = idx + 1;

    const isZebra = idx % 2 === 1;
    for (let col = 1; col <= 11; col++) {
      const cell = row.getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isZebra ? 'FFF8FAFC' : 'FFFFFFFF' },
      };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
      };
      if (col === 1 || col >= 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
      if (col === 1) {
        cell.font = { bold: true, color: { argb: 'FF64748B' } };
      } else if (col === 11) {
        cell.font = { bold: true, color: { argb: 'FF0F172A' } };
      }
    }
  }

  // Dynamic SORT formula (PTS col 10 desc, DG col 9 desc, GF col 7 desc)
  sortedSheet.getCell('B2').value = {
    formula: `SORT('Tabla de Posiciones'!B2:K${lastStandingsRow},10,FALSE,9,FALSE,7,FALSE)`,
  };

  // Download .xlsx file in browser
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileNameBase}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
