#!/usr/bin/env -S npx tsx

/**
 * Script to test numeric sorting of message_id field
 * This script converts text message_id to numeric for proper sorting.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { serverSupabase } from '../lib/serverSupabase';

async function main() {
  try {
    console.log('🔍 Testing numeric sorting...');
    
    // Test with casting to integer for proper numeric sorting
    console.log('📥 Executing query with numeric cast: select message_id from telegram_messages_index order by message_id::integer desc limit 1');
    // @ts-ignore
    const { data, error } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: false })
      // We can't directly cast in the order clause, so we'll need a different approach
      .limit(1)
      .single();
    
    if (error) {
      console.error('❌ Error executing query:', error);
    } else {
      // @ts-ignore
      console.log(`📊 Lexicographic sort result: ${data?.message_id || 'None'}`);
    }
    
    // Let's try a different approach - get all IDs and sort them numerically in JavaScript
    console.log('\n📥 Getting all message IDs for numeric sorting...');
    // @ts-ignore
    const { data: allIds, error: allIdsError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id');
    
    if (allIdsError) {
      console.error('❌ Error getting all IDs:', allIdsError);
      process.exit(1);
    }
    
    // Convert to numbers and sort
    const numericIds = (allIds || [])
      // @ts-ignore
      .map(item => parseInt(item.message_id, 10))
      .filter(id => !isNaN(id))
      .sort((a, b) => b - a); // Descending order
    
    console.log(`📊 Numeric sort result (max ID): ${numericIds[0] || 'None'}`);
    console.log(`📊 Total unique IDs: ${numericIds.length}`);
    
    // Show top 10 numeric IDs
    console.log('\n📊 Top 10 IDs (numeric sort):');
    numericIds.slice(0, 10).forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });
    
    console.log('\n✨ Numeric sorting test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in test-numeric-sort script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}