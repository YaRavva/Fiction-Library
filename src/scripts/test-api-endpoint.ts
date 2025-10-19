// Simple test to check if the API endpoint is working
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testApiEndpoint() {
  try {
    console.log('Testing API endpoint accessibility...');
    
    // Create a Supabase client with service role for testing
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Try to directly access the telegram_stats table
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
    
    console.log('Direct database query successful:');
    console.log('Data:', JSON.stringify(data, null, 2));
    
    // Test the mapping that the API should do
    const mappedData = {
      booksInDatabase: data.files_downloaded || 0,
      booksInTelegram: data.messages_processed || 0,
      missingBooks: data.errors_count || 0,
      booksWithoutFiles: 0
    };
    
    console.log('\nMapped data (what API should return):');
    console.log(JSON.stringify(mappedData, null, 2));
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testApiEndpoint();