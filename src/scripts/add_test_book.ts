import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';
import dotenv from 'dotenv';

dotenv.config();

async function getLatestBookMetadata() {
  try {
    console.log('🚀 Getting latest book metadata from Telegram...');

    const telegramService = await TelegramService.getInstance();
    const metadataChannel = await telegramService.getMetadataChannel();
    // @ts-ignore
    const messages = await telegramService.getMessages(metadataChannel.id, 1);

    if (messages && messages.length > 0) {
      const latestMessage = messages[0];
      // @ts-ignore
      const messageText = latestMessage.text;

      if (messageText) {
        console.log('📝 Parsing metadata from the latest message...');
        const metadata = MetadataParser.parseMessage(messageText);
        console.log('✅ Metadata parsed successfully:');
        console.log(JSON.stringify(metadata, null, 2));
      } else {
        console.log('⚠️ The latest message does not contain any text.');
      }
    } else {
      console.log('⚠️ No messages found in the metadata channel.');
    }
  } catch (error) {
    console.error('❌ Error getting latest book metadata:', error);
  } finally {
    // Disconnect the client
    const telegramService = await TelegramService.getInstance();
    await telegramService.disconnect();
  }
}

getLatestBookMetadata();