import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { BookWormService } from '../lib/telegram/book-worm-service';

async function runFullSyncBookWorm() {
    console.log('🐋 Запуск Книжного Червя в режиме ПОЛНОЙ СИНХРОНИЗАЦИИ...');
    console.log(`📅 Время запуска: ${new Date().toLocaleString('ru-RU')}`);
    
    // Увеличиваем таймаут для полной синхронизации
    const TIMEOUT_MS = 60 * 60 * 1000; // 1 час
    
    // Создаем таймер для принудительного завершения
    const timeout = setTimeout(() => {
        console.log('⏰ Время выполнения истекло. Принудительное завершение...');
        process.exit(0);
    }, TIMEOUT_MS);
    
    try {
        // Создаем экземпляр сервиса
        const bookWorm = new BookWormService();
        
        // Запускаем полную синхронизацию
        const result = await bookWorm.runFullSync();
        
        console.log('\n🎉 Книжный Червь успешно завершил полную синхронизацию!');
        console.log(`📊 Статистика выполнения:`);
        console.log(`   📚 Метаданные - Обработано: ${result.metadata.processed}, Добавлено: ${result.metadata.added}`);
        console.log(`   📁 Файлы - Обработано: ${result.files.processed}, Привязано: ${result.files.linked}`);
        
        clearTimeout(timeout); // Очищаем таймер
        process.exit(0);
    } catch (error) {
        console.error('💥 Книжный Червь столкнулся с непредвиденной ошибкой:', error);
        clearTimeout(timeout); // Очищаем таймер
        process.exit(1);
    }
}

// Запуск скрипта
runFullSyncBookWorm().catch(console.error);