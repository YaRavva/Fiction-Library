#!/usr/bin/env -S npx tsx

/**
 * Script to clear the telegram_messages_index table
 * This script deletes all records from the telegram_messages_index table.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Clearing telegram_messages_index table...');
    
    // First, check how many records we have
    console.log('📥 Checking current record count...');
    // @ts-ignore
    const { count, error: countError } = await serverSupabase
      .from('telegram_messages_index')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting record count:', countError);
      process.exit(1);
    }
    
    console.log(`📊 Current records: ${count || 0}`);
    
    // Confirm before deletion
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(`⚠️  Are you sure you want to delete all ${count || 0} records from telegram_messages_index? (yes/no): `, async (answer: string) => {
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled.');
        process.exit(0);
      }
      
      // Delete all records
      console.log('🗑️  Deleting all records...');
      // @ts-ignore
      const { error } = await serverSupabase
        .from('telegram_messages_index')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records (dummy condition)
      
      if (error) {
        console.error('❌ Error deleting records:', error);
        process.exit(1);
      }
      
      console.log('✅ All records deleted successfully!');
      
      // Verify the table is empty
      console.log('📥 Verifying table is empty...');
      // @ts-ignore
      const { count: newCount, error: newCountError } = await serverSupabase
        .from('telegram_messages_index')
        .select('*', { count: 'exact', head: true });
      
      if (newCountError) {
        console.error('❌ Error verifying empty table:', newCountError);
        process.exit(1);
      }
      
      console.log(`📊 Records after deletion: ${newCount || 0}`);
      
      console.log('\n✨ Table cleared successfully!');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error in clear-telegram-messages-index script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}