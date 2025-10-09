#!/usr/bin/env -S npx tsx

/**
 * Script to check indexed messages in the telegram_messages_index table
 * This script shows the latest indexed messages to verify the indexing process.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Checking indexed messages...');
    
    // Get the latest 10 indexed messages
    console.log('📥 Getting latest 10 indexed messages...');
    // @ts-ignore
    const { data: latestMessages, error: latestError } = await serverSupabase
      .from('telegram_messages_index')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (latestError) {
      console.error('❌ Error getting latest messages:', latestError);
      process.exit(1);
    }
    
    console.log('\n📊 Latest 10 indexed messages:');
    console.log('=============================');
    for (const message of latestMessages || []) {
      // @ts-ignore
      console.log(`ID: ${message.message_id}, Author: ${message.author || 'N/A'}, Title: ${message.title || 'N/A'}, Created: ${message.created_at}`);
    }
    
    // Get the earliest indexed messages
    console.log('\n📥 Getting earliest 10 indexed messages...');
    // @ts-ignore
    const { data: earliestMessages, error: earliestError } = await serverSupabase
      .from('telegram_messages_index')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(10);
      
    if (earliestError) {
      console.error('❌ Error getting earliest messages:', earliestError);
      process.exit(1);
    }
    
    console.log('\n📊 Earliest 10 indexed messages:');
    console.log('===============================');
    for (const message of earliestMessages || []) {
      // @ts-ignore
      console.log(`ID: ${message.message_id}, Author: ${message.author || 'N/A'}, Title: ${message.title || 'N/A'}, Created: ${message.created_at}`);
    }
    
    // Get total count of indexed messages
    console.log('\n📥 Getting total count of indexed messages...');
    // @ts-ignore
    const { count, error: countError } = await serverSupabase
      .from('telegram_messages_index')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ Error getting count:', countError);
      process.exit(1);
    }
    
    console.log(`\n📊 Total indexed messages: ${count || 0}`);
    
    console.log('\n✨ Check completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in check-indexed-messages script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}