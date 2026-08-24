import fs from 'fs';
import path from 'path';

let JWTClass: any = null;
let googleObj: any = null;

try {
  const authLib = require('google-auth-library');
  const googleapisLib = require('googleapis');
  JWTClass = authLib.JWT;
  googleObj = googleapisLib.google;
} catch (e) {
  console.warn('Warning: googleapis or google-auth-library not installed. Falling back to local google-sheet.md file.');
}

let credentials = {
  client_email: undefined as string | undefined,
  private_key: undefined as string | undefined,
};

if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  credentials = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
} else {
  try {
    const credsPath = path.join(process.cwd(), 'services', 'GoogleSheetService', 'credentials.json');
    if (fs.existsSync(credsPath)) {
      const fileContent = fs.readFileSync(credsPath, 'utf8');
      const json = JSON.parse(fileContent);
      credentials = {
        client_email: json.client_email,
        private_key: json.private_key,
      };
    }
  } catch (error) {
    console.warn('Warning: credentials.json not found or could not be read, and environment variables are not set.');
  }
}


export interface ParsedSheetRow {
  year: string;
  competition: string;
  instance: string;
  teamA: string;
  countryA: string;
  teamB: string;
  countryB: string;
  firstLeg: string;
  secondLeg: string;
  agg: string;
}

export async function getRawSheetData(sheetId: string, range: string): Promise<string[][] | null | undefined> {
  if (!JWTClass || !googleObj) {
    throw new Error('Dependencies missing');
  }

  const auth = new JWTClass({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = googleObj.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  return res.data.values;
}

export function getLocalFallbackData(): ParsedSheetRow[] {
  try {
    const filePath = path.join(process.cwd(), 'google-sheet.md');
    if (!fs.existsSync(filePath)) {
      console.error(`Local file not found at: ${filePath}`);
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const parsed: ParsedSheetRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Separamos por tabulador
      const columns = line.split('\t');
      if (columns.length >= 9) {
        parsed.push({
          year: columns[0] || '',
          competition: columns[1] || '',
          instance: columns[2] || '',
          teamA: columns[3] || '',
          countryA: columns[4] || '',
          teamB: columns[5] || '',
          countryB: columns[6] || '',
          firstLeg: columns[7] || '',
          secondLeg: columns[8] || '',
          agg: columns[9] || '',
        });
      }
    }

    return parsed;
  } catch (error) {
    console.error('Error reading local fallback file:', error);
    return [];
  }
}

export async function getParsedSheetData(sheetId: string, range: string): Promise<ParsedSheetRow[]> {
  try {
    const rawData = await getRawSheetData(sheetId, range);
    if (!rawData || rawData.length <= 1) {
      console.log('No raw data returned from Google API, using local fallback.');
      return getLocalFallbackData();
    }

    const rows = rawData.slice(1);

    return rows.map((row) => ({
      year: row[0] || '',
      competition: row[1] || '',
      instance: row[2] || '',
      teamA: row[3] || '',
      countryA: row[4] || '',
      teamB: row[5] || '',
      countryB: row[6] || '',
      firstLeg: row[7] || '',
      secondLeg: row[8] || '',
      agg: row[9] || '',
    }));
  } catch (error) {
    console.log('Google Sheets API failed or credentials not configured. Falling back to local google-sheet.md file.');
    return getLocalFallbackData();
  }
}