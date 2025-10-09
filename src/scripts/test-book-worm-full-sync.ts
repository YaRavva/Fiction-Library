import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { BookWormService } from '../lib/telegram/book-worm-service';

async function testBookWormFullSync() {
    console.log('🐋 Тестирование полной синхронизации Книжного Червя...');
    
    try {
        // Создаем экземпляр сервиса
        const bookWorm = new BookWormService();
        
        // Запускаем полную синхронизацию
        const result = await bookWorm.runFullSync();
        
        console.log('\n🎉 Тест полной синхронизации завершен!');
        console.log(`📊 Статистика выполнения:`);
        console.log(`   📚 Метаданные - Обработано: ${result.metadata.processed}, Добавлено: ${result.metadata.added}`);
        console.log(`   📁 Файлы - Обработано: ${result.files.processed}, Привязано: ${result.files.linked}`);
        
    } catch (error) {
        console.error('💥 Ошибка при тестировании Книжного Червя:', error);
        process.exit(1);
    }
}

// Запуск теста
testBookWormFullSync().catch(console.error);