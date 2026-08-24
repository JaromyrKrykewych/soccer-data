const BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY_FOOTBALL;

interface ApiResponse<T> {
  get: string;
  parameters: Record<string, any>;
  errors: Record<string, string> | any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}

// Interfaces for API-Football responses
export interface ApiLeague {
  league: {
    id: number;
    name: string;
    type: 'League' | 'Cup';
    logo: string;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
  seasons: Array<{
    year: number;
    start: string;
    end: string;
    current: boolean;
  }>;
}

export interface ApiTeam {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    national: boolean;
    logo: string;
  };
  venue: {
    id: number | null;
    name: string | null;
    address: string | null;
    city: string | null;
    capacity: number | null;
    surface: string | null;
    image: string | null;
  } | null;
}

export interface ApiFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface ApiStanding {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    standings: Array<Array<{
      rank: number;
      team: {
        id: number;
        name: string;
        logo: string;
      };
      points: number;
      goalsDiff: number;
      group: string;
      form: string;
      status: string;
      description: string | null;
      all: {
        played: number;
        win: number;
        draw: number;
        lose: number;
        goals: {
          for: number;
          against: number;
        };
      };
      home: Record<string, any>;
      away: Record<string, any>;
      update: string;
    }>>;
  };
}

class ApiSourceService {
  private static async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T[]> {
    if (!API_KEY) {
      console.warn('Warning: NEXT_PUBLIC_API_KEY_FOOTBALL is not set in environment variables.');
    }

    const url = new URL(`${BASE_URL}/${endpoint}`);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    });

    const headers: HeadersInit = {
      'x-apisports-key': API_KEY || '',
    };

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        next: { revalidate: 3600 } // Cache results for 1 hour by default in Next.js
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as ApiResponse<T>;

      if (data.errors && !Array.isArray(data.errors) && Object.keys(data.errors).length > 0) {
        console.error('API-Sports Error response:', data.errors);
        throw new Error(`API error: ${JSON.stringify(data.errors)}`);
      }

      return data.response;
    } catch (error) {
      console.error(`Error fetching from API-Sports endpoint /${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene la lista de ligas/copas y sus temporadas.
   */
  static async getLeagues(params?: {
    id?: number;
    name?: string;
    country?: string;
    code?: string;
    season?: number;
    type?: 'league' | 'cup';
    current?: 'true' | 'false';
  }): Promise<ApiLeague[]> {
    return this.request<ApiLeague>('leagues', params);
  }

  /**
   * Obtiene los equipos de una liga y temporada específica, o un equipo por su ID.
   */
  static async getTeams(params: {
    id?: number;
    name?: string;
    league?: number;
    season?: number;
    country?: string;
    search?: string;
  }): Promise<ApiTeam[]> {
    return this.request<ApiTeam>('teams', params);
  }

  /**
   * Obtiene los partidos (fixtures) filtrados por liga, temporada, rango de fechas o equipo.
   */
  static async getFixtures(params: {
    id?: number;
    ids?: string; // Comma-separated list of fixture ids
    live?: string; // "all" or specific leagues like "39-40-41"
    date?: string; // YYYY-MM-DD
    league?: number;
    season?: number;
    team?: number;
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
    status?: string;
    timezone?: string;
  }): Promise<ApiFixture[]> {
    return this.request<ApiFixture>('fixtures', params);
  }

  /**
   * Obtiene los partidos de historial cara a cara (H2H) entre dos equipos.
   * @param h2h Formato: "teamId1-teamId2" (ej. "33-34")
   */
  static async getH2H(params: {
    h2h: string;
    date?: string; // YYYY-MM-DD
    league?: number;
    season?: number;
    status?: string;
    timezone?: string;
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
  }): Promise<ApiFixture[]> {
    return this.request<ApiFixture>('fixtures/headtohead', params);
  }

  /**
   * Obtiene la tabla de posiciones de una liga y temporada específica.
   */
  static async getStandings(params: {
    league: number;
    season: number;
    team?: number;
  }): Promise<ApiStanding[]> {
    return this.request<ApiStanding>('standings', params);
  }
}

export default ApiSourceService;
