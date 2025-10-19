import { BookWormService } from '../lib/telegram/book-worm-service';
import dotenv from 'dotenv';

dotenv.config();

async function testBookWormS3Enhanced() {
  try {
    console.log('🚀 Расширенное тестирование Книжного Червя с S3 Cloud.ru...');
    
    const bookWorm = new BookWormService();
    
    // Тестируем режим обновления (менее ресурсоемкий)
    console.log('\n🔄 Запуск в режиме обновления...');
    const startTime = Date.now();
    const result = await bookWorm.run('update');
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
    
    // Проверяем эффективность (должно быть меньше повторных загрузок)
    const totalProcessed = result.files.processed;
    const totalLinked = result.files.linked;
    const totalSkipped = result.files.skipped;
    
    if (totalProcessed > 0) {
      const efficiency = ((totalLinked + totalSkipped) / totalProcessed) * 100;
      console.log(`📈 Эффективность: ${efficiency.toFixed(2)}%`);
    }
    
    console.log('\n✅ Расширенное тестирование завершено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при расширенном тестировании Книжного Червя:', error);
    process.exit(1);
  }
}

testBookWormS3Enhanced();