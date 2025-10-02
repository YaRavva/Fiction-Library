/**
 * Script to inspect the detailed structure of webpage objects in Telegram messages
 */

import dotenv from 'dotenv';
import path from 'path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { inspect } from 'util';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function inspectWebpageStructure() {
  console.log('🔍 Inspecting detailed structure of webpage objects...\n');

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
        
        if (anyMsg.media && anyMsg.media.className === 'MessageMediaWebPage') {
          console.log('\n🖼️ WebPage structure:');
          console.log('====================');
          
          // Detailed inspection of webpage object
          console.log('Full webpage object:');
          console.log(inspect(anyMsg.media.webpage, { depth: 10, colors: true }));
          
          console.log('\nWebpage URL:', anyMsg.media.webpage.url);
          console.log('Webpage type:', anyMsg.media.webpage.type);
          
          if (anyMsg.media.webpage.photo) {
            console.log('\n📸 Photo in webpage:');
            console.log('====================');
            console.log('Photo ID:', anyMsg.media.webpage.photo.id?.toString());
            console.log('Photo sizes:', anyMsg.media.webpage.photo.sizes?.length);
            
            if (anyMsg.media.webpage.photo.sizes) {
              anyMsg.media.webpage.photo.sizes.forEach((size: any, index: number) => {
                console.log(`  Size ${index}: ${size.className} (${size.type}) ${size.w}x${size.h}`);
              });
            }
          }
          
          // Check if there are other media elements
          console.log('\n🔍 Checking for other media elements:');
          console.log('====================================');
          
          // Check if webpage has other elements like documents or additional photos
          if (anyMsg.media.webpage.document) {
            console.log('⚠️  Webpage contains a document');
          }
          
          if (anyMsg.media.webpage.attributes) {
            console.log('Webpage attributes:', anyMsg.media.webpage.attributes);
          }
          
          break; // We found what we needed
        }
      }
    }

    await client.disconnect();
    console.log('\n✅ Inspection completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
inspectWebpageStructure();