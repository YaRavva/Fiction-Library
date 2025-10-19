import { BookWormService } from '../lib/telegram/book-worm-service';
import dotenv from 'dotenv';

dotenv.config();

async function testBookWormLimited() {
  try {
    console.log('🔍 Тестирование Книжного Червя на ограниченном наборе файлов...');
    
    const bookWorm = new BookWormService();
    
    // Тестируем режим обновления с ограничением на 10 файлов
    console.log('\n🔄 Запуск в режиме обновления (ограничено 10 файлами)...');
    
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
    
    // Анализируем эффективность
    const totalProcessed = result.files.processed;
    const totalLinked = result.files.linked;
    const totalSkipped = result.files.skipped;
    const totalErrors = result.files.errors;
    
    console.log('\n📈 Анализ эффективности:');
    console.log('=====================');
    
    if (totalProcessed > 0) {
      const successRate = ((totalLinked + totalSkipped) / totalProcessed) * 100;
      console.log(`Процент успешной обработки: ${successRate.toFixed(2)}%`);
    }
    
    if (totalLinked > 0) {
      console.log(`Успешно привязано файлов: ${totalLinked}`);
    }
    
    if (totalSkipped > 0) {
      console.log(`Пропущено файлов (уже существуют): ${totalSkipped}`);
    }
    
    if (totalErrors > 0) {
      console.log(`Ошибок: ${totalErrors}`);
    }
    
    console.log('\n✅ Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании Книжного Червя:', error);
    process.exit(1);
  }
}

testBookWormLimited();