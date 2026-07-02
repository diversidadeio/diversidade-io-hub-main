const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    const { data, error } = await supabase
      .from('socios')
      .update({ genero: 'Mulher cisgênero' })
      .in('genero', ['Mulher cis', 'Mulher Cis'])
      .select();

    if (error) {
      console.error('Error updating:', error);
    } else {
      console.log(`Updated ${data.length} records in socios table.`);
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

main();
