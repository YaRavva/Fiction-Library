import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testStatsEndpoint() {
  try {
    console.log('Testing stats endpoint...');
    
    // Create a Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Query the telegram_stats table directly
    const { data, error } = await supabase
      .from('telegram_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('Database query error:', error);
      return;
    }
    
    console.log('Database data:', data);
    
    // Test the mapping that the API should do
    const mappedData = {
      booksInDatabase: data.files_downloaded || 0,
      booksInTelegram: data.messages_processed || 0,
      missingBooks: data.errors_count || 0,
      booksWithoutFiles: 0
    };
    
    console.log('Mapped data:', mappedData);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testStatsEndpoint();