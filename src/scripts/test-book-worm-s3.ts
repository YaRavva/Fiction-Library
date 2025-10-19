import { BookWormService } from '../lib/telegram/book-worm-service';
import dotenv from 'dotenv';

dotenv.config();

async function testBookWormS3() {
  try {
    console.log('🚀 Тестирование Книжного Червя с S3 Cloud.ru...');
    
    const bookWorm = new BookWormService();
    
    // Тестируем режим обновления (менее ресурсоемкий)
    console.log('\n🔄 Запуск в режиме обновления...');
    const result = await bookWorm.run('update');
    
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
    
    console.log('\n✅ Тестирование завершено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании Книжного Червя:', error);
    process.exit(1);
  }
}

testBookWormS3();