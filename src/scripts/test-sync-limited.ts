import { BookWormService } from '../lib/telegram/book-worm-service';

async function testLimitedSync() {
  console.log('🚀 Начинаем синхронизацию новых книг (лимит: 1000)');
  
  try {
    // Создаем экземпляр BookWormService
    const bookWorm = await BookWormService.getInstance();
    
    // Запускаем синхронизацию с лимитом 1000 (режим update)
    const result = await bookWorm.runUpdateSync();
    
    console.log('✅ Синхронизация завершена успешно');
    console.log('📊 Результаты:', result);
  } catch (error) {
    console.error('❌ Ошибка при синхронизации:', error);
  }
}

// Запускаем тест
testLimitedSync();