import { supabase } from '@/services/supabase/supabase';
import TitlesClient from './TitlesClient';

export const dynamic = 'force-dynamic';

export default async function TitlesPage() {
  let titlesTableExists = true;
  let titlesList: any[] = [];

  try {
    // 1. Verificar si la tabla de títulos existe en Supabase
    const { error: checkError } = await supabase
      .from('titles')
      .select('id')
      .limit(1);

    if (checkError) {
      // Si hay error al consultar (ej. 'relation "titles" does not exist')
      titlesTableExists = false;
    } else {
      // 2. Obtener todos los títulos y unir con equipos, competiciones y temporadas
      const { data: dbTitles, error: fetchError } = await supabase
        .from('titles')
        .select(`
          id,
          title_name,
          teams (
            id,
            current_name,
            countries (
              id,
              name
            )
          ),
          competitions (
            id,
            name
          ),
          seasons (
            id,
            year_start,
            year_end
          )
        `);

      if (fetchError) {
        titlesTableExists = false;
      } else {
        titlesList = dbTitles || [];
      }
    }
  } catch (err) {
    titlesTableExists = false;
  }

  return (
    <TitlesClient
      initialTitles={titlesList}
      titlesTableExists={titlesTableExists}
    />
  );
}
