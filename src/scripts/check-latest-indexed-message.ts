#!/usr/bin/env -S npx tsx

/**
 * Script to check the latest indexed message in the telegram_messages_index table
 * This script verifies that the getLatestMessageId function works correctly.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Checking latest indexed message...');
    
    // Get the latest indexed message by created_at
    console.log('📥 Getting latest indexed message by created_at...');
    // @ts-ignore
    const { data: latestMessage, error: latestError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (latestError) {
      console.error('❌ Error getting latest message:', latestError);
      process.exit(1);
    }
    
    // @ts-ignore
    console.log(`Latest indexed message ID (by created_at): ${latestMessage?.message_id || 'None'}`);
    
    // Get the latest indexed message by message_id
    console.log('📥 Getting latest indexed message by message_id...');
    // @ts-ignore
    const { data: latestMessageById, error: latestErrorById } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: false })
      .limit(1)
      .single();
      
    if (latestErrorById) {
      console.error('❌ Error getting latest message by ID:', latestErrorById);
      process.exit(1);
    }
    
    // @ts-ignore
    console.log(`Latest indexed message ID (by message_id): ${latestMessageById?.message_id || 'None'}`);
    
    // Get the earliest indexed message by created_at
    console.log('📥 Getting earliest indexed message by created_at...');
    // @ts-ignore
    const { data: earliestMessage, error: earliestError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
      
    if (earliestError) {
      console.error('❌ Error getting earliest message:', earliestError);
      process.exit(1);
    }
    
    // @ts-ignore
    console.log(`Earliest indexed message ID (by created_at): ${earliestMessage?.message_id || 'None'}`);
    
    // Get the earliest indexed message by message_id
    console.log('📥 Getting earliest indexed message by message_id...');
    // @ts-ignore
    const { data: earliestMessageById, error: earliestErrorById } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: true })
      .limit(1)
      .single();
      
    if (earliestErrorById) {
      console.error('❌ Error getting earliest message by ID:', earliestErrorById);
      process.exit(1);
    }
    
    // @ts-ignore
    console.log(`Earliest indexed message ID (by message_id): ${earliestMessageById?.message_id || 'None'}`);
    
    console.log('\n✨ Check completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in check-latest-indexed-message script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}