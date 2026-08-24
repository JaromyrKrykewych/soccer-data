import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db_mock.json');

export interface MockTeam {
  id: number;
  current_name: string;
  country: string;
  api_sports_id: number | null;
  aliases: string[]; // para guardar otros nombres del google sheet
}

export interface MockMatch {
  id: number;
  season: string;
  competition: string;
  instance: string;
  home_team_id: number;
  away_team_id: number;
  home_goals: number;
  away_goals: number;
  is_leg1: boolean;
  penalty_home_goals?: number | null;
  penalty_away_goals?: number | null;
}

interface DbSchema {
  teams: MockTeam[];
  matches: MockMatch[];
}

const defaultDb: DbSchema = {
  teams: [
    // Pre-poblamos algunos equipos de prueba
    { id: 1, current_name: 'Slovan Bratislava', country: 'Svk', api_sports_id: 2026, aliases: ['Slovan Bratislava'] },
    { id: 2, current_name: 'The New Saints', country: 'Wal', api_sports_id: 3450, aliases: ['The New Saints'] },
  ],
  matches: [],
};

class MockDbService {
  private static readDb(): DbSchema {
    try {
      if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
        return defaultDb;
      }
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data) as DbSchema;
    } catch (e) {
      return defaultDb;
    }
  }

  private static writeDb(data: DbSchema): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing mock DB:', e);
    }
  }

  static getTeams(): MockTeam[] {
    return this.readDb().teams;
  }

  static getMatches(): MockMatch[] {
    return this.readDb().matches;
  }

  static addTeam(name: string, country: string, apiSportsId: number | null = null): MockTeam {
    const db = this.readDb();
    
    // Evitar duplicados por nombre actual o alias
    const existing = db.teams.find(
      (t) => t.current_name.toLowerCase() === name.toLowerCase() || 
             t.aliases.some(a => a.toLowerCase() === name.toLowerCase())
    );
    if (existing) return existing;

    const newTeam: MockTeam = {
      id: db.teams.length > 0 ? Math.max(...db.teams.map((t) => t.id)) + 1 : 1,
      current_name: name,
      country,
      api_sports_id: apiSportsId,
      aliases: [name],
    };

    db.teams.push(newTeam);
    this.writeDb(db);
    return newTeam;
  }

  static addTeamAlias(teamId: number, alias: string): MockTeam | null {
    const db = this.readDb();
    const teamIndex = db.teams.findIndex((t) => t.id === teamId);
    if (teamIndex === -1) return null;

    const team = db.teams[teamIndex];
    if (!team.aliases.includes(alias)) {
      team.aliases.push(alias);
      db.teams[teamIndex] = team;
      this.writeDb(db);
    }
    return team;
  }

  static addMatch(match: Omit<MockMatch, 'id'>): MockMatch {
    const db = this.readDb();
    
    // Comprobar si ya existe el partido para evitar duplicados
    const existing = db.matches.find(
      (m) =>
        m.season === match.season &&
        m.competition === match.competition &&
        m.instance === match.instance &&
        m.home_team_id === match.home_team_id &&
        m.away_team_id === match.away_team_id &&
        m.is_leg1 === match.is_leg1
    );

    if (existing) return existing;

    const newMatch: MockMatch = {
      ...match,
      id: db.matches.length > 0 ? Math.max(...db.matches.map((m) => m.id)) + 1 : 1,
    };

    db.matches.push(newMatch);
    this.writeDb(db);
    return newMatch;
  }

  static findTeamByName(name: string): MockTeam | null {
    const db = this.readDb();
    return db.teams.find(
      (t) => t.current_name.toLowerCase() === name.toLowerCase() || 
             t.aliases.some(a => a.toLowerCase() === name.toLowerCase())
    ) || null;
  }

  static checkMatchImported(params: {
    season: string;
    competition: string;
    instance: string;
    homeTeamId: number;
    awayTeamId: number;
    isLeg1: boolean;
  }): boolean {
    const db = this.readDb();
    return db.matches.some(
      (m) =>
        m.season === params.season &&
        m.competition === params.competition &&
        m.instance === params.instance &&
        m.home_team_id === params.homeTeamId &&
        m.away_team_id === params.awayTeamId &&
        m.is_leg1 === params.isLeg1
    );
  }
}

export default MockDbService;
