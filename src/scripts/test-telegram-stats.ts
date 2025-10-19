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

async function testTelegramStats() {
  try {
    console.log('Testing telegram_stats table access...');
    
    // Get the latest stats record
    const { data, error } = await supabase
      .from('telegram_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error querying telegram_stats table:', error);
      return;
    }

    console.log('Latest telegram_stats record:');
    console.log(JSON.stringify(data, null, 2));
    
    // Test the mapping we're using in the API
    console.log('\nMapped values for API response:');
    console.log('- Messages processed (booksInTelegram):', data.messages_processed || 0);
    console.log('- Files downloaded (booksInDatabase):', data.files_downloaded || 0);
    console.log('- Errors count (missingBooks):', data.errors_count || 0);
    console.log('- Books without files (booksWithoutFiles):', 0); // Not available in real table
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTelegramStats();