#!/usr/bin/env -S npx tsx

/**
 * Script to test the direct query used in getLatestMessageId function
 * This script replicates the exact query to see what it returns.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Testing direct query...');
    
    // Replicate the exact query from getLatestMessageId function
    console.log('📥 Executing query: select message_id from telegram_messages_index order by message_id desc limit 1');
    // @ts-ignore
    const { data, error } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('❌ Error executing query:', error);
      process.exit(1);
    }
    
    // @ts-ignore
    console.log(`📊 Query result: ${data?.message_id || 'None'}`);
    
    // Let's also get a few more to see the pattern
    console.log('\n📥 Getting top 10 message IDs...');
    // @ts-ignore
    const { data: topIds, error: topIdsError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: false })
      .limit(10);
    
    if (topIdsError) {
      console.error('❌ Error getting top IDs:', topIdsError);
      process.exit(1);
    }
    
    console.log('📊 Top 10 message IDs:');
    for (const item of topIds || []) {
      // @ts-ignore
      console.log(`   ${item.message_id}`);
    }
    
    console.log('\n✨ Direct query test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in test-direct-query script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}