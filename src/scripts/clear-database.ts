/**
 * Script to completely clear the database
 * WARNING: This will remove all data from books, series, and related tables
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
config({ path: '.env.local' });
config({ path: '.env' });

// Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  console.error('Please ensure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in your environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function clearDatabase() {
  try {
    console.log('⚠️  WARNING: This will completely clear the database!');
    console.log('⚠️  All books, series, and related data will be permanently deleted!');
    console.log('⚠️  This action cannot be undone!\n');
    
    console.log('Proceeding with database clearing in 5 seconds...');
    console.log('Press Ctrl+C to cancel...\n');
    
    // Wait 5 seconds to give user a chance to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Clear tables in the correct order to avoid foreign key constraint issues
    const tables = [
      'reading_history',
      'user_bookmarks',
      'user_ratings',
      'user_books',
      'user_series',
      'books',
      'series',
      'telegram_download_queue',
      'telegram_sync_status',
      'user_profiles'
    ];
    
    let successCount = 0;
    
    for (const table of tables) {
      console.log(`Clearing table: ${table}`);
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '0'); // This will delete all rows
        
      if (error) {
        console.error(`❌ Error clearing table ${table}:`, error.message);
      } else {
        console.log(`✅ Table ${table} cleared successfully`);
        successCount++;
      }
    }
    
    console.log(`\n📊 Summary: ${successCount}/${tables.length} tables cleared successfully`);
    
    if (successCount === tables.length) {
      console.log('✅ Database cleared successfully!');
      console.log('All data has been removed from the database.');
    } else {
      console.log('⚠️  Some tables may not have been cleared successfully.');
    }
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  }
}

// Run the script
clearDatabase();