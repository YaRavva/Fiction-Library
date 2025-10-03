/**
 * Script to search for specific files in the Telegram files channel
 */

import { config } from 'dotenv';

// Load environment variables FIRST
config({ path: '.env' });

async function searchTelegramFiles() {
  // Dynamically import TelegramService after dotenv is loaded
  const { TelegramService } = await import('../lib/telegram/client');
  
  let telegramClient: any = null;
  
  try {
    console.log('🔍 Searching for files in Telegram channel...\n');
    
    // Initialize Telegram client
    console.log('Initializing Telegram client...');
    telegramClient = await TelegramService.getInstance();
    console.log('✅ Telegram client initialized');
    
    // Access the files channel
    console.log('Accessing files channel...');
    const channel = await telegramClient.getFilesChannel();
    // @ts-ignore
    console.log(`✅ Channel: ${channel.title}\n`);
    
    // Define search terms for the books we're looking for
    const searchTerms = [
      "Эвернесс",
      "Евернес",
      "Everness",
      "Индия",
      "India",
      "Луна",
      "Moon",
      "Уголёк в пепле",
      "Ashes of Ember",
      "Линия фронта",
      "Frontline",
      "Йен Макдональд",
      "Ian McDonald",
      "Саба Тахир",
      "Saba Tahir",
      "Марко Клоос",
      "Marco Kloos"
    ];
    
    console.log('Searching for files matching our books...\n');
    
    // Search for each term using the messages search method
    for (const term of searchTerms) {
      console.log(`\nSearching for: "${term}"`);
      
      try {
        // @ts-ignore
        const { Api } = await import('telegram/tl/api.js');
        
        // @ts-ignore
        const result = await telegramClient.client.invoke(
          new Api.messages.Search({
            peer: channel,
            q: term,
            filter: new Api.InputMessagesFilterDocument(), // Only search for documents/files
            limit: 20
          })
        );
        
        if (result && result.messages && result.messages.length > 0) {
          console.log(`  Found ${result.messages.length} results for "${term}":`);
          
          for (const msg of result.messages) {
            // @ts-ignore
            if (msg.media && msg.media.document) {
              // @ts-ignore
              const document = msg.media.document;
              if (document) {
                // @ts-ignore
                const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
                const filename = filenameAttr?.fileName || `book_${msg.id}`;
                // @ts-ignore
                const size = document.size || 0;
                
                console.log(`    📎 ${filename} (${size} bytes) - Message ID: ${msg.id}`);
              }
            }
          }
        } else {
          console.log(`  No results found for "${term}"`);
        }
      } catch (error: any) {
        console.error(`  Error searching for "${term}":`, error.message);
      }
    }
    
    console.log('\n✅ Search completed.');
    
  } catch (error) {
    console.error('❌ Error searching files:', error);
    process.exit(1);
  } finally {
    // Ensure proper cleanup
    if (telegramClient) {
      try {
        // @ts-ignore
        await telegramClient.disconnect();
        console.log('\n🧹 Telegram client disconnected');
      } catch (error) {
        console.error('⚠️ Error during shutdown:', error);
      }
    }
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run the script
searchTelegramFiles().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});