import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { BookWormService } from '../lib/telegram/book-worm-service';

async function runBookWorm() {
    console.log('🐋 Инициализация Книжного Червя...');
    
    // Увеличиваем таймаут для выполнения
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 минут
    
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
        
        console.log('\n🎉 Книжный Червь завершил свою миссию!');
        clearTimeout(timeout); // Очищаем таймер
        process.exit(0);
    } catch (error) {
        console.error('💥 Книжный Червь столкнулся с непредвиденной ошибкой:', error);
        clearTimeout(timeout); // Очищаем таймер
        process.exit(1);
    }
}

// Запуск скрипта
runBookWorm().catch(console.error);