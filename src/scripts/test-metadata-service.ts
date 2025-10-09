import { TelegramMetadataService } from '../lib/telegram/metadata-service';

async function testMetadataService() {
  try {
    console.log('🚀 Тестирование Metadata Service...');
    
    // Получаем экземпляр сервиса
    const metadataService = await TelegramMetadataService.getInstance();
    console.log('✅ Сервис инициализирован');
    
    // Простой тест - получаем ID последнего сообщения
    console.log('🔍 Получение ID последнего сообщения...');
    const latestMessageId = await metadataService.getLatestMessageId();
    console.log(`✅ Последнее сообщение в индексе: ${latestMessageId || 'не найдено'}`);
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Run the test
testMetadataService().then(() => {
  console.log('✅ Тест завершен');
  process.exit(0);
});