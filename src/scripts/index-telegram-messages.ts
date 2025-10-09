#!/usr/bin/env -S npx tsx

/**
 * Script to index all Telegram messages for fast lookup and new book detection
 * This script creates an index of all messages in the Telegram channel
 * storing only ID, author, and title for efficient new book detection.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { TelegramMetadataService } from '../lib/telegram/metadata-service';

async function main() {
  try {
    console.log('🚀 Starting Telegram messages indexing...');
    
    // Get the metadata service instance
    const metadataService = await TelegramMetadataService.getInstance();
    
    // Index all messages with default batch size
    console.log('📥 Indexing all Telegram messages...');
    const result = await metadataService.indexAllMessages();
    
    console.log('\n📊 INDEXING COMPLETE:');
    console.log('====================');
    console.log(`Indexed messages: ${result.indexed}`);
    console.log(`Errors: ${result.errors}`);
    
    if (result.errors > 0) {
      console.log('\n⚠️  Some errors occurred during indexing.');
      console.log('Check the logs above for details.');
    } else {
      console.log('\n✅ All messages indexed successfully!');
    }
    
    // Get the latest message ID to demonstrate the new functionality
    console.log('\n🔍 Checking latest message ID...');
    const latestMessageId = await metadataService.getLatestMessageId();
    if (latestMessageId) {
      console.log(`Latest message ID: ${latestMessageId}`);
    } else {
      console.log('No messages found in index.');
    }
    
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in index-telegram-messages script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}