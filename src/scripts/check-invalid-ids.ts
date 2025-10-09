#!/usr/bin/env -S npx tsx

/**
 * Script to check for invalid message_id values that cannot be converted to numbers
 * This script identifies problematic message_id values.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Checking for invalid message_id values...');
    
    // Get all message IDs
    console.log('📥 Getting all message IDs...');
    // @ts-ignore
    const { data: allIds, error: allIdsError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id');
    
    if (allIdsError) {
      console.error('❌ Error getting all IDs:', allIdsError);
      process.exit(1);
    }
    
    console.log(`📊 Total records: ${allIds?.length || 0}`);
    
    // Check for invalid IDs
    const validIds = [];
    const invalidIds = [];
    
    for (const item of allIds || []) {
      // @ts-ignore
      const idStr = item.message_id;
      const idNum = parseInt(idStr, 10);
      
      if (isNaN(idNum)) {
        invalidIds.push(idStr);
      } else {
        validIds.push(idNum);
      }
    }
    
    console.log(`📊 Valid numeric IDs: ${validIds.length}`);
    console.log(`📊 Invalid IDs: ${invalidIds.length}`);
    
    if (invalidIds.length > 0) {
      console.log('\n📋 Invalid IDs (first 20):');
      invalidIds.slice(0, 20).forEach(id => {
        console.log(`   "${id}"`);
      });
    }
    
    // Sort valid IDs numerically and show top 10
    validIds.sort((a, b) => b - a); // Descending order
    console.log('\n📊 Top 10 valid IDs (numeric sort):');
    validIds.slice(0, 10).forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });
    
    // Check if we have the expected maximum ID
    console.log(`\n📊 Maximum valid ID: ${validIds[0] || 'None'}`);
    
    console.log('\n✨ Invalid ID check completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in check-invalid-ids script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}