/**
 * Script to test media download from Telegram messages
 */

import dotenv from 'dotenv';
import path from 'path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { inspect } from 'util';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testMediaDownload() {
  console.log('🔍 Testing media download from Telegram messages...\n');

  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION;
  const metadataChannel = process.env.TELEGRAM_METADATA_CHANNEL;

  if (!apiId || !apiHash || !sessionString || !metadataChannel) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  try {
    // Create client
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => await Promise.reject('Interactive login not supported'),
      phoneCode: async () => await Promise.reject('Interactive login not supported'),
      password: async () => await Promise.reject('Interactive login not supported'),
      onError: (err) => console.error('Telegram client error:', err),
    });

    console.log('✅ Connected to Telegram\n');

    // Get channel
    const username = metadataChannel.split('/').pop() || metadataChannel;
    const channel = await client.getEntity(username);
    
    // Get messages that contain "цикл Луна"
    const messages = await client.getMessages(channel, { limit: 50 });
    
    console.log(`Found ${messages.length} messages\n`);
    
    // Look for "цикл Луна" message
    for (const msg of messages) {
      if (!msg || !msg.message) continue;
      
      if (msg.message.includes('цикл Луна')) {
        console.log(`📝 Found "цикл Луна" message (ID: ${msg.id})`);
        
        const anyMsg: any = msg;
        
        if (anyMsg.media) {
          console.log(`\n🖼️ Media type: ${anyMsg.media.className}`);
          
          // Try different download approaches
          if (anyMsg.media.className === 'MessageMediaWebPage' && anyMsg.media.webpage?.photo) {
            console.log('\n📸 Testing download of photo from webpage...');
            
            try {
              // Method 1: Download photo directly
              console.log('  → Downloading photo directly...');
              const photoBuffer = await client.downloadMedia(anyMsg.media.webpage.photo);
              if (photoBuffer instanceof Buffer) {
                console.log(`  ✅ Successfully downloaded photo: ${photoBuffer.length} bytes`);
                
                // Save to file for inspection
                const fs = require('fs');
                fs.writeFileSync('test_downloaded_photo.jpg', photoBuffer);
                console.log('  → Saved as test_downloaded_photo.jpg');
              } else {
                console.log('  ⚠️ Downloaded content is not a buffer');
              }
            } catch (err) {
              console.error('  ❌ Error downloading photo:', err);
            }
            
            try {
              // Method 2: Download the entire media object
              console.log('  → Downloading entire media object...');
              const mediaBuffer = await client.downloadMedia(anyMsg.media);
              if (mediaBuffer instanceof Buffer) {
                console.log(`  ✅ Successfully downloaded media: ${mediaBuffer.length} bytes`);
                
                // Save to file for inspection
                const fs = require('fs');
                fs.writeFileSync('test_downloaded_media.jpg', mediaBuffer);
                console.log('  → Saved as test_downloaded_media.jpg');
              } else {
                console.log('  ⚠️ Downloaded content is not a buffer');
              }
            } catch (err) {
              console.error('  ❌ Error downloading media:', err);
            }
            
            // Check if there are other downloadable elements
            console.log('\n🔍 Checking for other downloadable elements...');
            
            // Check webpage for other media
            if (anyMsg.media.webpage) {
              const webpage: any = anyMsg.media.webpage;
              
              if (webpage.document) {
                console.log('  → Webpage contains a document');
              }
              
              if (webpage.attributes) {
                console.log('  → Webpage attributes:', webpage.attributes);
              }
              
              if (webpage.cachedPage) {
                console.log('  → Webpage has cached page content');
              }
            }
          }
        }
        
        break; // We found what we needed
      }
    }

    await client.disconnect();
    console.log('\n✅ Test completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
testMediaDownload();