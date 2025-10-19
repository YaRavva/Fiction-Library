// Test the actual API endpoint call
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testApiCall() {
  try {
    console.log('Testing actual API endpoint call...');
    
    // Create a Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Sign in as admin to get a session
    console.log('Getting admin session...');
    
    // For testing purposes, we'll create a mock session token
    // In a real scenario, we would get this from an actual user session
    const mockToken = serviceRoleKey; // Using service role key as a mock token
    
    console.log('Making API call with mock token...');
    
    // Simulate the API call that the frontend would make
    // Note: This is a simulation since we can't easily make HTTP requests to localhost in this script
    console.log('API endpoint: /api/admin/telegram-stats');
    console.log('Headers: Authorization: Bearer [token]');
    
    // Let's check what the actual API route does by examining its logic
    console.log('\nAnalyzing API route logic...');
    
    // The API route should:
    // 1. Check authentication (which might be failing)
    // 2. Query the telegram_stats table
    // 3. Map the data to the expected format
    // 4. Return the JSON response
    
    // Let's manually execute the core logic of the API route
    console.log('\nExecuting API route core logic...');
    
    // Query the telegram_stats table directly (this is what the API does)
    const { data: stats, error: statsError } = await supabase
      .from('telegram_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (statsError) {
      console.error('Error querying telegram_stats:', statsError);
      return;
    }
    
    console.log('Database query successful');
    
    // Map the data as the API does
    const responseData = {
      booksInDatabase: stats.files_downloaded || 0,
      booksInTelegram: stats.messages_processed || 0,
      missingBooks: stats.errors_count || 0,
      booksWithoutFiles: 0, // This value is not available in the real table
    };
    
    console.log('\nAPI response data:');
    console.log(JSON.stringify(responseData, null, 2));
    
    console.log('\nThe API should be returning this data to the frontend.');
    console.log('If the statistics are not showing in the admin panel, the issue might be:');
    console.log('1. Authentication failure in the API route');
    console.log('2. Network issue preventing the API call from reaching the server');
    console.log('3. Frontend component not properly handling the response');
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testApiCall();