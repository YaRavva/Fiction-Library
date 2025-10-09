import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { BookWormService } from '../lib/telegram/book-worm-service';

// Функция для отправки статуса (в будущем можно использовать для интеграции с API)
function sendStatus(status: string, progress: number = 0) {
    // Пока просто логируем, в будущем можно отправлять в API
    console.log(`📊 Статус: ${status}, Прогресс: ${progress}%`);
}

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
        
        // Проверяем, указан ли режим работы
        const mode = process.argv[2] || 'auto'; // по умолчанию автоматический режим
        
        console.log(`🎯 Режим: ${mode === 'full' ? 'Полная синхронизация' : mode === 'update' ? 'Обновление' : mode === 'index' ? 'Индексация' : 'Автоматический'}`);
        sendStatus(`Запуск в режиме ${mode}`, 0);
        
        let result;
        switch (mode) {
            case 'full':
                console.log('🐋 Запуск Книжного Червя в режиме ПОЛНОЙ СИНХРОНИЗАЦИИ...');
                sendStatus('Начало полной синхронизации', 5);
                result = await bookWorm.runFullSync();
                sendStatus('Полная синхронизация завершена', 100);
                break;
            case 'update':
                console.log('🐋 Запуск Книжного Червя в режиме ОБНОВЛЕНИЯ...');
                sendStatus('Начало обновления', 5);
                result = await bookWorm.runUpdateSync();
                sendStatus('Обновление завершено', 100);
                break;
            case 'index':
                console.log('🐋 Запуск Книжного Червя в режиме РАСШИРЕННОЙ ИНДЕКСАЦИИ...');
                sendStatus('Начало расширенной индексации', 5);
                await bookWorm.advancedIndexMessages(100);
                sendStatus('Расширенная индексация завершена', 100);
                break;
            case 'auto':
            default:
                console.log('🐋 Запуск Книжного Червя в АВТОМАТИЧЕСКОМ режиме...');
                sendStatus('Начало автоматической синхронизации', 5);
                result = await bookWorm.runAutoSync();
                sendStatus('Автоматическая синхронизация завершена', 100);
                break;
        }
        
        console.log('\n🎉 Книжный Червь завершил свою миссию!');
        clearTimeout(timeout); // Очищаем таймер
        process.exit(0);
    } catch (error) {
        console.error('💥 Книжный Червь столкнулся с непредвиденной ошибкой:', error);
        sendStatus('Ошибка выполнения', 0);
        clearTimeout(timeout); // Очищаем таймер
        process.exit(1);
    }
}

// Запуск скрипта
runBookWorm().catch(console.error);