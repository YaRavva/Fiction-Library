#!/usr/bin/env -S npx tsx

/**
 * Script to test the getLatestMessageId function directly
 * This script verifies that the function works correctly.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { TelegramMetadataService } from '../lib/telegram/metadata-service';

async function main() {
  try {
    console.log('🔍 Testing getLatestMessageId function...');
    
    // Get the metadata service instance
    const metadataService = await TelegramMetadataService.getInstance();
    
    // Test the getLatestMessageId function
    console.log('📥 Testing getLatestMessageId...');
    const latestId = await metadataService.getLatestMessageId();
    
    console.log(`\n📊 RESULT:`);
    console.log('============');
    console.log(`Latest indexed message ID: ${latestId || 'None'}`);
    
    console.log('\n✨ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in test-get-latest-message-id script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}