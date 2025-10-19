import { BookWormService } from '../lib/telegram/book-worm-service';
import dotenv from 'dotenv';

dotenv.config();

async function testBatchProcessing() {
  try {
    console.log('🔍 Тестирование обработки файлов батчами...');
    
    const bookWorm = new BookWormService();
    
    // Тестируем режим обновления с ограничением на 10 файлов
    console.log('\n🔄 Запуск в режиме обновления...');
    
    // Засекаем время начала
    const startTime = Date.now();
    
    // Выполняем синхронизацию
    const result = await bookWorm.run('update');
    
    // Засекаем время окончания
    const endTime = Date.now();
    
    console.log('\n📊 Результаты тестирования:');
    console.log('========================');
    console.log(`📚 Метаданные:`);
    console.log(`   Обработано: ${result.metadata.processed}`);
    console.log(`   Добавлено: ${result.metadata.added}`);
    console.log(`   Обновлено: ${result.metadata.updated}`);
    console.log(`   Пропущено: ${result.metadata.skipped}`);
    console.log(`   Ошибок: ${result.metadata.errors}`);
    console.log(`📁 Файлы:`);
    console.log(`   Обработано: ${result.files.processed}`);
    console.log(`   Привязано: ${result.files.linked}`);
    console.log(`   Пропущено: ${result.files.skipped}`);
    console.log(`   Ошибок: ${result.files.errors}`);
    console.log(`⏱  Время выполнения: ${((endTime - startTime) / 1000).toFixed(2)} секунд`);
    
    console.log('\n✅ Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании обработки батчами:', error);
    process.exit(1);
  }
}

testBatchProcessing();