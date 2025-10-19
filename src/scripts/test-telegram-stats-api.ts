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

async function testApiEndpoint() {
  try {
    console.log('Testing telegram-stats API endpoint...');
    
    // First, let's check if we can get a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return;
    }
    
    if (!session) {
      console.log('No session found. Signing in with service role...');
      // For testing purposes, we'll use the service role key directly
      console.log('Using service role key for direct access');
    }
    
    // Test the actual table structure
    console.log('\n1. Testing direct database access...');
    const { data: stats, error: statsError } = await supabase
      .from('telegram_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (statsError) {
      console.error('Error querying telegram_stats table:', statsError);
      return;
    }

    console.log('Latest telegram_stats record:');
    console.log(JSON.stringify(stats, null, 2));
    
    console.log('\n2. Simulating API response mapping...');
    const apiResponse = {
      booksInDatabase: stats.files_downloaded || 0,
      booksInTelegram: stats.messages_processed || 0,
      missingBooks: stats.errors_count || 0,
      booksWithoutFiles: 0, // Not available in real table
    };
    
    console.log('Mapped API response:');
    console.log(JSON.stringify(apiResponse, null, 2));
    
    console.log('\n3. Testing if values would display correctly in UI...');
    console.log('- Messages processed (booksInTelegram):', apiResponse.booksInTelegram);
    console.log('- Files downloaded (booksInDatabase):', apiResponse.booksInDatabase);
    console.log('- Errors count (missingBooks):', apiResponse.missingBooks);
    console.log('- Books without files (booksWithoutFiles):', apiResponse.booksWithoutFiles);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testApiEndpoint();