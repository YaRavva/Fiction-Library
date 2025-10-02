import { config } from 'dotenv';
import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';

// Load environment variables from .env file
config({ path: '.env.local' });
config({ path: '.env' });

async function debugCoverLoading() {
  try {
    console.log('🔍 Debugging cover loading from Telegram albums...');
    
    // Initialize Telegram client
    const client = await TelegramService.getInstance();
    
    // Get metadata channel
    const channel = await client.getMetadataChannel();
    
    // Get more messages to increase chances of finding albums
    const messages = await client.getMessages(channel, 100);
    
    console.log(`Found ${messages.length} messages`);
    
    let albumCount = 0;
    let webPageCount = 0;
    let photoCount = 0;
    let documentCount = 0;
    let noMediaCount = 0;
    
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
      console.log(`\n--- Found ${albumGroups.size} album groups ---`);
      for (const [groupId, groupMessages] of albumGroups) {
        console.log(`\nAlbum Group ${groupId}: ${groupMessages.length} messages`);
        groupMessages.forEach((msg, index) => {
          console.log(`  Message ${index + 1} (ID: ${msg.id}):`);
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
            } else if (msg.media.photo) {
              console.log(`    → Direct photo`);
            } else if (msg.media.document) {
              console.log(`    → Document (mime type: ${msg.media.document?.mimeType})`);
            }
          } else {
            console.log(`    No media content`);
          }
        });
      }
    } else {
      console.log('\n--- No album groups found in the messages ---');
    }
    
    // Show statistics
    for (let i = 0; i < messages.length; i++) {
      const msg: any = messages[i];
      
      if (msg.groupedId) {
        albumCount++;
      }
      
      if (msg.media) {
        if (msg.media.className === 'MessageMediaWebPage' && msg.media.webpage?.photo) {
          webPageCount++;
        } else if (msg.media.photo) {
          photoCount++;
        } else if (msg.media.document) {
          documentCount++;
        }
      } else {
        noMediaCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Total messages: ${messages.length}`);
    console.log(`  - Album messages: ${albumCount}`);
    console.log(`  - Web page messages: ${webPageCount}`);
    console.log(`  - Direct photo messages: ${photoCount}`);
    console.log(`  - Document messages: ${documentCount}`);
    console.log(`  - No media messages: ${noMediaCount}`);
    console.log(`  - Album groups: ${albumGroups.size}`);
    
    // Let's also check for specific series that should have multiple covers
    console.log('\n--- Checking for "цикл Одаренные" or "цикл Луна" ---');
    for (let i = 0; i < messages.length; i++) {
      const msg: any = messages[i];
      if (msg.text && (msg.text.includes('Одаренные') || msg.text.includes('Луна'))) {
        console.log(`\nFound message with ID ${msg.id} containing series:`);
        const metadata = MetadataParser.parseMessage(msg.text);
        console.log(`  Title: ${metadata.title}`);
        console.log(`  Series: ${metadata.series || 'None'}`);
        console.log(`  Books count: ${metadata.books?.length || 0}`);
        if (metadata.books) {
          metadata.books.forEach((book, index) => {
            console.log(`    Book ${index + 1}: ${book.title} (${book.year})`);
          });
        }
        console.log(`  Media type: ${msg.media?.className || 'None'}`);
        if (msg.media?.className === 'MessageMediaWebPage') {
          console.log(`  Webpage URL: ${msg.media.webpage?.url || 'None'}`);
        }
      }
    }
    
    console.log('✅ Debug completed');
    
  } catch (error) {
    console.error('Error during debug:', error);
  }
}

// Run the debug script
debugCoverLoading();