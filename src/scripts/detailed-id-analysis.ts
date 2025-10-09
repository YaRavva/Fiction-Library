#!/usr/bin/env -S npx tsx

/**
 * Script for detailed analysis of message IDs in the telegram_messages_index table
 * This script provides a comprehensive view of the ID distribution.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Detailed ID analysis...');
    
    // Get total count
    console.log('📥 Getting total count...');
    // @ts-ignore
    const { count, error: countError } = await serverSupabase
      .from('telegram_messages_index')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting count:', countError);
      process.exit(1);
    }
    
    console.log(`📊 Total records: ${count || 0}`);
    
    // Get min and max IDs
    console.log('📥 Getting min and max IDs...');
    
    // Max ID
    // @ts-ignore
    const { data: maxData, error: maxError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: false })
      .limit(1)
      .single();
    
    if (maxError) {
      console.error('❌ Error getting max ID:', maxError);
      process.exit(1);
    }
    
    // @ts-ignore
    const maxId = maxData?.message_id ? parseInt(maxData.message_id, 10) : 0;
    console.log(`📊 Maximum ID: ${maxId}`);
    
    // Min ID
    // @ts-ignore
    const { data: minData, error: minError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: true })
      .limit(1)
      .single();
    
    if (minError) {
      console.error('❌ Error getting min ID:', minError);
      process.exit(1);
    }
    
    // @ts-ignore
    const minId = minData?.message_id ? parseInt(minData.message_id, 10) : 0;
    console.log(`📊 Minimum ID: ${minId}`);
    
    // Get some specific high IDs to verify they exist
    console.log('\n🔍 Checking specific high IDs...');
    const highIdsToCheck = [4929, 4928, 4927, 4925, 4924, 4923, 4922, 4921, 4918, 4917];
    
    for (const id of highIdsToCheck) {
      // @ts-ignore
      const { data: specificData, error: specificError } = await serverSupabase
        .from('telegram_messages_index')
        .select('message_id')
        .eq('message_id', id.toString())
        .single();
      
      if (specificError) {
        console.log(`   ID ${id}: Error - ${specificError.message}`);
      } else if (specificData) {
        // @ts-ignore
        console.log(`   ID ${id}: Found - ${specificData.message_id}`);
      } else {
        console.log(`   ID ${id}: Not found`);
      }
    }
    
    // Get records around the max ID we're seeing (999)
    console.log('\n🔍 Checking records around ID 999...');
    // @ts-ignore
    const { data: around999, error: around999Error } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .gte('message_id', '990')
      .lte('message_id', '1010')
      .order('message_id', { ascending: true });
    
    if (around999Error) {
      console.error('❌ Error getting records around 999:', around999Error);
    } else {
      console.log('   Records around 999:');
      for (const record of around999 || []) {
        // @ts-ignore
        console.log(`     ${record.message_id}`);
      }
    }
    
    console.log('\n✨ Detailed analysis completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in detailed-id-analysis script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}