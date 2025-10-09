#!/usr/bin/env -S npx tsx

/**
 * Script to directly check the latest message ID in the telegram_messages_index table
 * This script bypasses the service layer to verify the data directly.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Directly checking latest message ID...');
    
    // Direct query to get the latest message ID
    console.log('📥 Querying database directly...');
    // @ts-ignore
    const { data, error } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('❌ Error querying database:', error);
      process.exit(1);
    }
    
    // @ts-ignore
    console.log(`📊 Direct query result: ${data?.message_id || 'None'}`);
    
    // Let's also check a few more to see the pattern
    console.log('\n📥 Getting top 5 message IDs...');
    // @ts-ignore
    const { data: topIds, error: topIdsError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: false })
      .limit(5);
    
    if (topIdsError) {
      console.error('❌ Error getting top IDs:', topIdsError);
      process.exit(1);
    }
    
    console.log('📊 Top 5 message IDs:');
    for (const item of topIds || []) {
      // @ts-ignore
      console.log(`   ${item.message_id}`);
    }
    
    console.log('\n✨ Direct check completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in direct-check-latest-id script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}