#!/usr/bin/env -S npx tsx

/**
 * Script to analyze message IDs in the telegram_messages_index table
 * This script shows the range of message IDs and identifies gaps.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Analyzing message IDs in index...');
    
    // Get all message IDs (with pagination for large datasets)
    console.log('📥 Getting all message IDs...');
    let allMessages: any[] = [];
    let lastId: string | undefined = undefined;
    const batchSize = 1000;
    
    while (true) {
      // @ts-ignore
      let query = serverSupabase
        .from('telegram_messages_index')
        .select('message_id')
        .order('message_id', { ascending: true })
        .limit(batchSize);
      
      if (lastId) {
        // @ts-ignore
        query = query.gt('message_id', lastId);
      }
      
      // @ts-ignore
      const { data: batch, error: batchError } = await query;
      
      if (batchError) {
        console.error('❌ Error getting message IDs batch:', batchError);
        process.exit(1);
      }
      
      if (!batch || batch.length === 0) {
        break;
      }
      
      allMessages = allMessages.concat(batch);
      
      if (batch.length < batchSize) {
        break;
      }
      
      // @ts-ignore
      lastId = batch[batch.length - 1].message_id;
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    
    // Convert to array of numbers and sort
    const messageIds = (allMessages || [])
      // @ts-ignore
      .map(msg => parseInt(msg.message_id as string, 10))
      .sort((a, b) => a - b);
    
    console.log(`📊 Total messages indexed: ${messageIds.length}`);
    console.log(`🔢 Lowest message ID: ${messageIds[0]}`);
    console.log(`🔢 Highest message ID: ${messageIds[messageIds.length - 1]}`);
    
    // Find gaps in the sequence
    console.log('\n🔍 Analyzing gaps in message IDs...');
    let gaps = 0;
    let totalGaps = 0;
    for (let i = 1; i < messageIds.length; i++) {
      const gap = messageIds[i] - messageIds[i - 1] - 1;
      if (gap > 0) {
        gaps++;
        totalGaps += gap;
        // Show first few gaps as examples
        if (gaps <= 5) {
          console.log(`   Gap: ${messageIds[i - 1]} → ${messageIds[i]} (missing ${gap} IDs)`);
        }
      }
    }
    
    console.log(`📊 Total gaps found: ${gaps}`);
    console.log(`📊 Total missing IDs in gaps: ${totalGaps}`);
    
    // Show some statistics
    const minId = messageIds[0];
    const maxId = messageIds[messageIds.length - 1];
    const range = maxId - minId + 1;
    const density = (messageIds.length / range * 100).toFixed(2);
    
    console.log(`\n📈 Statistics:`);
    console.log(`   ID Range: ${minId} - ${maxId} (${range} possible IDs)`);
    console.log(`   Actual IDs: ${messageIds.length}`);
    console.log(`   Density: ${density}%`);
    
    // Show first and last 10 message IDs
    console.log(`\n📋 First 10 message IDs:`);
    console.log(`   ${messageIds.slice(0, 10).join(', ')}`);
    
    console.log(`\n📋 Last 10 message IDs:`);
    console.log(`   ${messageIds.slice(-10).join(', ')}`);
    
    console.log('\n✨ Analysis completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in analyze-message-ids script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}