#!/usr/bin/env -S npx tsx

/**
 * Script to test the checkForNewMessages function in BookWormService
 * This script verifies that the new messages detection works correctly.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { BookWormService } from '../lib/telegram/book-worm-service';

async function main() {
  try {
    console.log('🔍 Testing checkForNewMessages function...');
    
    // Get the BookWorm service instance
    const bookWorm = new BookWormService();
    
    // Test the checkForNewMessages function
    console.log('📥 Testing checkForNewMessages...');
    const result = await bookWorm.checkForNewMessages();
    
    console.log('\n📊 CHECK RESULT:');
    console.log('================');
    console.log(`Latest indexed message ID: ${result.latestIndexedId || 'None'}`);
    console.log(`Latest Telegram message ID: ${result.latestTelegramId || 'None'}`);
    console.log(`Has new messages: ${result.hasNewMessages}`);
    
    if (result.hasNewMessages) {
      console.log('🆕 New messages detected!');
    } else {
      console.log('✅ No new messages found.');
    }
    
    console.log('\n✨ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in test-check-new-messages script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}