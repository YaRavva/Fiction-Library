import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkTableStructure() {
  try {
    // Try to get table info using a simple query
    const { data, error } = await supabase
      .from('telegram_stats')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error querying telegram_stats table:', error);
      return;
    }

    console.log('Table structure based on sample data:');
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample row:', data[0]);
    } else {
      console.log('Table is empty or does not exist');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTableStructure();