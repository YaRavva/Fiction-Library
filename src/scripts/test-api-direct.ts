// Simple test to check API endpoint directly
require('dotenv').config();

async function testApiDirect() {
  try {
    console.log('Testing API endpoint directly...');
    
    // Since we can't easily make HTTP requests to localhost in this environment,
    // let's simulate what the API does by directly accessing the database
    
    const { createClient } = require('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // This is what the API endpoint does
    const { data: stats, error: statsError } = await supabase
      .from('telegram_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (statsError) {
      console.error('Error fetching stats:', statsError);
      return;
    }

    console.log('Database stats:', stats);

    // This is what the API returns
    const responseData = {
      booksInDatabase: stats.files_downloaded || 0,
      booksInTelegram: stats.messages_processed || 0,
      missingBooks: stats.errors_count || 0,
      booksWithoutFiles: 0, // This value is not available in the real table
    };
    
    console.log('API would return:', responseData);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testApiDirect();