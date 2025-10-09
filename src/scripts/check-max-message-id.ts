#!/usr/bin/env -S npx tsx

/**
 * Script to check the maximum message ID in the telegram_messages_index table
 * This script verifies the actual maximum ID regardless of sorting.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Checking maximum message ID...');
    
    // Get the maximum message ID
    console.log('📥 Getting maximum message ID...');
    // @ts-ignore
    const { data, error } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('❌ Error getting maximum message ID:', error);
      process.exit(1);
    }
    
    // @ts-ignore
    console.log(`📊 Maximum message ID: ${data?.message_id || 'None'}`);
    
    // Also check the minimum ID for completeness
    console.log('📥 Getting minimum message ID...');
    // @ts-ignore
    const { data: minData, error: minError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: true })
      .limit(1)
      .single();
    
    if (minError) {
      console.error('❌ Error getting minimum message ID:', minError);
      process.exit(1);
    }
    
    // @ts-ignore
    console.log(`📊 Minimum message ID: ${minData?.message_id || 'None'}`);
    
    console.log('\n✨ Check completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in check-max-message-id script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}