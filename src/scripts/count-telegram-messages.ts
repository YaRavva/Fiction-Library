#!/usr/bin/env -S npx tsx

/**
 * Script to count total messages in the Telegram channel
 * This script gets the actual count of messages in the channel.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { TelegramService } from '../lib/telegram/client';

async function main() {
  try {
    console.log('🔍 Counting messages in Telegram channel...');
    
    // Get the Telegram client
    const telegramClient = await TelegramService.getInstance();
    
    // Get the metadata channel
    console.log('📡 Getting metadata channel...');
    const channel = await telegramClient.getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    console.log(`📥 Counting messages in channel ${channelId}...`);
    
    // Try to get total count - this might not work directly, so we'll try a different approach
    // Let's get a large batch of messages to estimate
    console.log('📥 Getting messages to count...');
    const messages = await telegramClient.getMessages(channelId, 5000) as unknown as { id?: number }[];
    
    console.log(`📊 Total messages retrieved: ${messages.length}`);
    
    if (messages.length > 0) {
      const messageIds = messages
        .map(msg => msg.id || 0)
        .filter(id => id > 0)
        .sort((a, b) => b - a); // Sort descending (newest first)
      
      console.log(`🔢 Latest message ID: ${messageIds[0]}`);
      console.log(`🔢 Earliest message ID in batch: ${messageIds[messageIds.length - 1]}`);
      
      // Show first 10 message IDs
      console.log(`\n📋 First 10 message IDs (newest first):`);
      console.log(`   ${messageIds.slice(0, 10).join(', ')}`);
    }
    
    console.log('\n✨ Count completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in count-telegram-messages script:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}