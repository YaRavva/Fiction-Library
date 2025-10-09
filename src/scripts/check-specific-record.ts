#!/usr/bin/env -S npx tsx

/**
 * Script to check a specific record in the telegram_messages_index table by UUID
 * This script finds the record with the given UUID and shows its message_id.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Checking specific record by UUID...');
    
    // Check the record with the given UUID
    console.log('📥 Getting record with UUID: 0016ec63-56dc-437a-b098-ee38ba01670b');
    // @ts-ignore
    const { data, error } = await serverSupabase
      .from('telegram_messages_index')
      .select('*')
      .eq('id', '0016ec63-56dc-437a-b098-ee38ba01670b')
      .single();
    
    if (error) {
      console.error('❌ Error getting record:', error);
      process.exit(1);
    }
    
    if (!data) {
      console.log('❌ Record not found');
      process.exit(1);
    }
    
    // @ts-ignore
    console.log(`📊 Record found:`);
    // @ts-ignore
    console.log(`   ID: ${data.id}`);
    // @ts-ignore
    console.log(`   Message ID: ${data.message_id}`);
    // @ts-ignore
    console.log(`   Author: ${data.author || 'N/A'}`);
    // @ts-ignore
    console.log(`   Title: ${data.title || 'N/A'}`);
    // @ts-ignore
    console.log(`   Created at: ${data.created_at}`);
    
    console.log('\n✨ Check completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in check-specific-record script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}