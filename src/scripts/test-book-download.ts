/**
 * Script to test book download from private Telegram channel
 */

import { config } from 'dotenv';
import { TelegramService } from '../lib/telegram/client';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

async function testBookDownload() {
  try {
    console.log('🔍 Testing book download from private Telegram channel...\n');
    
    // Initialize Telegram client
    const client = await TelegramService.getInstance();
    
    // Get files channel
    console.log('Getting files channel...');
    const channel = await client.getFilesChannel();
    console.log('✅ Files channel obtained\n');
    
    // Get messages from files channel
    console.log('Getting messages from files channel...');
    const messages = await client.getMessages(channel, 5);
    console.log(`✅ Found ${messages.length} messages\n`);
    
    // Show message details
    for (let i = 0; i < messages.length; i++) {
      const msg: any = messages[i];
      console.log(`Message ${i + 1}:`);
      console.log(`  ID: ${msg.id}`);
      console.log(`  Date: ${msg.date}`);
      
      if (msg.message) {
        console.log(`  Text: ${msg.message.substring(0, 50)}...`);
      }
      
      if (msg.media) {
        console.log(`  Media type: ${msg.media.className}`);
        
        // Check for document
        if (msg.media.document) {
          console.log(`  Document file name: ${msg.media.document.fileName || 'Unknown'}`);
          console.log(`  Document mime type: ${msg.media.document.mimeType || 'Unknown'}`);
          console.log(`  Document size: ${msg.media.document.size || 'Unknown'}`);
        }
      }
      
      console.log('');
    }
    
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the script
testBookDownload();