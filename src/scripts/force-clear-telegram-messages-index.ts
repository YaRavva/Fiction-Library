#!/usr/bin/env -S npx tsx

/**
 * Script to force clear the telegram_messages_index table
 * This script deletes all records from the telegram_messages_index table without confirmation.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🚀 Force clearing telegram_messages_index table...');
    
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
    
    // Delete all records using a condition that matches all records
    console.log('🗑️  Deleting all records...');
    // @ts-ignore
    const { error } = await serverSupabase
      .from('telegram_messages_index')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // This will match all records since no ID is all zeros
    
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
  } catch (error) {
    console.error('❌ Error in force-clear-telegram-messages-index script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}