This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


### Create tables

-- =========================================
-- 1) Países
-- =========================================
CREATE TABLE Countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    iso_code VARCHAR(10)
);

-- =========================================
-- 2) Equipos (Con ID de API oficial y restricción de nombre único)
-- =========================================
CREATE TABLE Teams (
    id SERIAL PRIMARY KEY,
    current_name VARCHAR(150) NOT NULL,
    founded_year INT,
    country_id INT REFERENCES Countries(id),
    api_sports_id INT UNIQUE -- ID de la API para sincronización
);

-- =========================================
-- 3) Historial de nombres de equipos
-- =========================================
CREATE TABLE TeamNames (
    id SERIAL PRIMARY KEY,
    team_id INT REFERENCES Teams(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    from_year INT,
    to_year INT,
    CONSTRAINT unique_team_name_alias UNIQUE (team_id, name)
);

-- =========================================
-- 4) Historial de países de un club
-- =========================================
CREATE TABLE TeamCountries (
    id SERIAL PRIMARY KEY,
    team_id INT REFERENCES Teams(id) ON DELETE CASCADE,
    country_id INT REFERENCES Countries(id),
    from_year INT,
    to_year INT
);

-- =========================================
-- 5) Competiciones (Con ID de la API oficial)
-- =========================================
CREATE TABLE Competitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    type VARCHAR(20) CHECK (type IN ('league', 'cup', 'international')),
    country_id INT REFERENCES Countries(id), -- NULL si es internacional
    api_sports_id INT UNIQUE -- ID de la API para sincronización
);

-- =========================================
-- 6) Temporadas
-- =========================================
CREATE TABLE Seasons (
    id SERIAL PRIMARY KEY,
    competition_id INT REFERENCES Competitions(id) ON DELETE CASCADE,
    year_start INT NOT NULL,
    year_end INT NOT NULL,
    CONSTRAINT unique_season UNIQUE (competition_id, year_start, year_end)
);

-- =========================================
-- 7) Partidos (Soporta Rondas, Ida/Vuelta y Penales)
-- =========================================
CREATE TABLE Matches (
    id SERIAL PRIMARY KEY,
    season_id INT REFERENCES Seasons(id) ON DELETE CASCADE,
    home_team_id INT REFERENCES Teams(id),
    away_team_id INT REFERENCES Teams(id),
    home_goals INT,
    away_goals INT,
    penalty_home_goals INT, -- Goles en tanda de penaltis (local)
    penalty_away_goals INT, -- Goles en tanda de penaltis (visitante)
    match_date DATE,
    is_neutral BOOLEAN DEFAULT FALSE,
    stadium_name VARCHAR(150),
    round VARCHAR(50),      -- Instancia: "Q1", "Group A", "Final", etc.
    is_leg1 BOOLEAN DEFAULT TRUE, -- TRUE para partido de ida, FALSE para vuelta
    api_sports_id INT UNIQUE -- Opcional: ID de partido de la API
);

-- =========================================
-- 9) Títulos (Versión Super Completa)
-- =========================================
CREATE TABLE Titles (
    id SERIAL PRIMARY KEY,
    team_id INT REFERENCES Teams(id) ON DELETE CASCADE,
    competition_id INT REFERENCES Competitions(id) ON DELETE CASCADE,
    season_id INT REFERENCES Seasons(id) ON DELETE CASCADE,
    title_name VARCHAR(100) NOT NULL CHECK (title_name IN ('champion', 'runner-up')),
    CONSTRAINT unique_season_team UNIQUE (season_id, team_id),
    CONSTRAINT unique_season_title UNIQUE (season_id, title_name)
);

<!-- Cree hasta aca -->

-- =========================================
-- 8) Tabla de posiciones de ligas
-- =========================================
CREATE TABLE LeagueStandings (
    id SERIAL PRIMARY KEY,
    season_id INT REFERENCES Seasons(id) ON DELETE CASCADE,
    team_id INT REFERENCES Teams(id),
    position INT,
    points INT,
    played INT,
    wins INT,
    draws INT,
    losses INT,
    goals_for INT,
    goals_against INT
);


### Periodo de competiciones

| **Copa de Europa** - **CL**  | **1955-56 a 1991-92** (renombrada luego como Champions League) |
| **UEFA Champions League** - **CL**  | **1992-93 – actualidad** |
| **Recopa de Europa** - **CW**  | **1960-61 a 1998-99** |
| **Copa de Ferias** - **FC**  | **1955-58 a 1970-71** |
| **Copa UEFA** - **EL**  | **1971-72 a 2008-09** (renombrada luego como Europa League) |
| **UEFA Europa League** - **EL**  | **2009-10 – actualidad**  |
| **UEFA Europa Conference League**  | **2021-22 – actualidad** |
| **Supercopa de Europa** **SC** | **1972 – actualidad** |
