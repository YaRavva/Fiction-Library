import { TelegramMetadataService } from '../lib/telegram/metadata-service';

async function testNewMessagesSync() {
  try {
    console.log('🚀 Тестирование синхронизации новых сообщений...');
    
    // Получаем экземпляр сервиса
    const metadataService = await TelegramMetadataService.getInstance();
    
    // Получаем ID последнего сообщения
    console.log('🔍 Получение ID последнего сообщения...');
    const latestMessageId = await metadataService.getLatestMessageId();
    console.log(`✅ Последнее сообщение в индексе: ${latestMessageId || 'не найдено'}`);
    
    // Получаем ID последнего обработанного сообщения
    console.log('🔍 Получение ID последнего обработанного сообщения...');
    const lastProcessedId = await metadataService.getLastProcessedMessageId();
    console.log(`✅ Последнее обработанное сообщение: ${lastProcessedId || 'не найдено'}`);
    
    // Находим новые сообщения
    console.log('🔍 Поиск новых сообщений...');
    const newMessages = await metadataService.findNewMessages(5);
    console.log(`✅ Найдено новых сообщений: ${newMessages.length}`);
    
    if (newMessages.length > 0) {
      console.log('📝 Список новых сообщений:');
      newMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ID: ${msg.message_id}, Автор: ${msg.author || 'не указан'}, Название: ${msg.title || 'не указано'}`);
      });
    }
    
    // Пробуем синхронизацию (с небольшим лимитом для теста)
    console.log('🔄 Пробуем синхронизацию новых сообщений (лимит: 3)...');
    const syncResult = await metadataService.syncBooks(3);
    console.log('📊 Результаты синхронизации:');
    console.log(`   Обработано: ${syncResult.processed}`);
    console.log(`   Добавлено: ${syncResult.added}`);
    console.log(`   Обновлено: ${syncResult.updated}`);
    console.log(`   Пропущено: ${syncResult.skipped}`);
    console.log(`   Ошибок: ${syncResult.errors}`);
    
    if (syncResult.details.length > 0) {
      console.log('📋 Детали:');
      syncResult.details.forEach((detail, index) => {
        console.log(`   ${index + 1}. ${JSON.stringify(detail)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Run the test
testNewMessagesSync();