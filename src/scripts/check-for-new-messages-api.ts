#!/usr/bin/env -S npx tsx

/**
 * Script to check for new messages in the Telegram channel using the BookWorm service
 * This script uses the BookWorm service to check if there are new messages
 * without needing to spawn separate processes.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { BookWormService } from '../lib/telegram/book-worm-service';

async function main() {
  try {
    console.log('🚀 Checking for new messages in Telegram channel...');
    
    // Get the BookWorm service instance
    const bookWorm = new BookWormService();
    
    // Check for new messages
    console.log('🔍 Checking for new messages...');
    const result = await bookWorm.checkForNewMessages();
    
    console.log('\n📊 CHECK RESULT:');
    console.log('================');
    console.log(`Latest indexed message ID: ${result.latestIndexedId || 'None'}`);
    console.log(`Latest Telegram message ID: ${result.latestTelegramId || 'None'}`);
    
    if (result.hasNewMessages) {
      console.log('🆕 New messages detected!');
      console.log('   Consider running index-telegram-messages.ts to update the index.');
    } else {
      console.log('✅ No new messages found. The index is up to date.');
    }
    
    console.log('\n✨ Check completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in check-for-new-messages-api script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}