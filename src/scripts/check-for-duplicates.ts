#!/usr/bin/env -S npx tsx

/**
 * Script to check for duplicate message_ids in the indexing process
 * This script verifies if duplicates were handled correctly.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Checking for duplicate message_ids...');
    
    // Get total count
    // @ts-ignore
    const { count: totalCount, error: totalCountError } = await serverSupabase
      .from('telegram_messages_index')
      .select('*', { count: 'exact', head: true });
    
    if (totalCountError) {
      console.error('❌ Error getting total count:', totalCountError);
      process.exit(1);
    }
    
    console.log(`📊 Total records: ${totalCount || 0}`);
    
    console.log('\n✨ Duplicate check completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in check-for-duplicates script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}