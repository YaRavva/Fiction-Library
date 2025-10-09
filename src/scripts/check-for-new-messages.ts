#!/usr/bin/env -S npx tsx

/**
 * Script to check for new messages in the Telegram channel
 * This script compares the latest message ID in the index with the actual latest message
 * to determine if there are new books available.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { TelegramMetadataService } from '../lib/telegram/metadata-service';
import { TelegramService } from '../lib/telegram/client';

async function main() {
  try {
    console.log('🚀 Checking for new messages in Telegram channel...');
    
    // Get the metadata service instance
    const metadataService = await TelegramMetadataService.getInstance();
    const telegramClient = await TelegramService.getInstance();
    
    // Get the latest message ID from our index
    console.log('🔍 Getting latest indexed message ID...');
    const latestIndexedId = await metadataService.getLatestMessageId();
    console.log(`Latest indexed message ID: ${latestIndexedId || 'None'}`);
    
    // Get the actual latest message ID from Telegram
    console.log('📡 Getting latest actual message ID from Telegram...');
    const channel = await telegramClient.getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    // Get the latest message from Telegram
    const messages = await telegramClient.getMessages(channelId, 1) as unknown as { id?: number }[];
    const latestTelegramId = messages && messages.length > 0 && messages[0].id ? 
        String(messages[0].id) : null;
    
    console.log(`Latest Telegram message ID: ${latestTelegramId || 'None'}`);
    
    // Compare the IDs
    if (!latestIndexedId) {
      console.log('⚠️  No messages indexed yet. Consider running index-telegram-messages.ts first.');
    } else if (!latestTelegramId) {
      console.log('⚠️  No messages found in Telegram channel.');
    } else if (latestIndexedId === latestTelegramId) {
      console.log('✅ No new messages found. The index is up to date.');
    } else {
      console.log('🆕 New messages detected!');
      console.log('   Consider running index-telegram-messages.ts to update the index.');
    }
    
    console.log('\n✨ Check completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in check-for-new-messages script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}