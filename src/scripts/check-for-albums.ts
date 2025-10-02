/**
 * Script to check for actual albums with multiple images in Telegram messages
 */

import { config } from 'dotenv';
import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

async function checkForAlbums() {
  try {
    console.log('🔍 Checking for actual albums with multiple images...');
    
    // Initialize Telegram client
    const client = await TelegramService.getInstance();
    
    // Get metadata channel
    const channel = await client.getMetadataChannel();
    
    // Get a large number of messages to increase chances of finding albums
    const messages = await client.getMessages(channel, 200);
    
    console.log(`Found ${messages.length} messages`);
    
    // Look for any messages with groupedId
    const albumGroups = new Map<string, any[]>();
    
    for (let i = 0; i < messages.length; i++) {
      const msg: any = messages[i];
      
      if (msg.groupedId) {
        const groupId = String(msg.groupedId);
        if (!albumGroups.has(groupId)) {
          albumGroups.set(groupId, []);
        }
        albumGroups.get(groupId)!.push(msg);
      }
    }
    
    if (albumGroups.size > 0) {
      console.log(`\n🎉 Found ${albumGroups.size} album groups!`);
      for (const [groupId, groupMessages] of albumGroups) {
        console.log(`\nAlbum Group ${groupId}: ${groupMessages.length} messages`);
        for (const msg of groupMessages) {
          console.log(`  Message ID: ${msg.id}`);
          if (msg.text) {
            const metadata = MetadataParser.parseMessage(msg.text);
            console.log(`    Title: ${metadata.title}`);
            console.log(`    Series: ${metadata.series || 'None'}`);
          } else {
            console.log(`    No text content`);
          }
          
          if (msg.media) {
            console.log(`    Media type: ${msg.media.className}`);
            if (msg.media.className === 'MessageMediaWebPage' && msg.media.webpage?.photo) {
              console.log(`    → Web page preview with photo`);
              console.log(`    → URL: ${msg.media.webpage.url}`);
            } else if (msg.media.photo) {
              console.log(`    → Direct photo`);
            } else if (msg.media.document) {
              console.log(`    → Document (mime type: ${msg.media.document?.mimeType})`);
            }
          } else {
            console.log(`    No media content`);
          }
        }
      }
    } else {
      console.log('\n⚠️ No album groups found in the messages');
      console.log('All messages appear to be single images or web page previews with single images.');
    }
    
    console.log('\n✅ Check completed');
    
  } catch (error) {
    console.error('Error during check:', error);
  }
}

// Run the script
checkForAlbums();