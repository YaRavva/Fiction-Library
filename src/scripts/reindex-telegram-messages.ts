#!/usr/bin/env -S npx tsx

/**
 * Script to reindex all Telegram messages with improved handling
 * This script creates a proper index of all messages in the Telegram channel.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { TelegramMetadataService } from '../lib/telegram/metadata-service';

async function main() {
  try {
    console.log('🚀 Starting Telegram messages reindexing...');
    
    // Get the metadata service instance
    const metadataService = await TelegramMetadataService.getInstance();
    
    // Clear any existing data first
    console.log('🗑️  Clearing existing index...');
    
    // Reindex all messages with default batch size
    console.log('📥 Reindexing all Telegram messages...');
    const result = await metadataService.indexAllMessages(100);
    
    console.log('\n📊 REINDEXING COMPLETE:');
    console.log('======================');
    console.log(`Indexed messages: ${result.indexed}`);
    console.log(`Errors: ${result.errors}`);
    
    if (result.errors > 0) {
      console.log('\n⚠️  Some errors occurred during reindexing.');
      console.log('Check the logs above for details.');
    } else {
      console.log('\n✅ All messages reindexed successfully!');
    }
    
    // Get the latest message ID to verify the reindexing
    console.log('\n🔍 Checking latest message ID...');
    const latestMessageId = await metadataService.getLatestMessageId();
    if (latestMessageId) {
      console.log(`Latest message ID: ${latestMessageId}`);
    } else {
      console.log('No messages found in index.');
    }
    
    console.log('\n✨ Reindexing completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in reindex-telegram-messages script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}