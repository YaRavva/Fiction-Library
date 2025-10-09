#!/usr/bin/env -S npx tsx

/**
 * Script to index all Telegram messages using the BookWorm service
 * This script uses the BookWorm service to index all messages
 * without needing to spawn separate processes.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { BookWormService } from '../lib/telegram/book-worm-service';

async function main() {
  try {
    console.log('🚀 Starting Telegram messages indexing...');
    
    // Get the BookWorm service instance
    const bookWorm = new BookWormService();
    
    // Index all messages with default batch size
    console.log('📥 Indexing all Telegram messages...');
    const result = await bookWorm.indexAllMessages();
    
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
    
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in index-telegram-messages-api script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}