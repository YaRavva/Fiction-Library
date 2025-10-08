import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { BookWormService } from '../lib/telegram/book-worm-service';

/**
 * Запускает Книжного Червя по расписанию
 */
async function runScheduledBookWorm() {
    console.log('⏰ Запланированный запуск Книжного Червя');
    console.log(`📅 Время запуска: ${new Date().toLocaleString('ru-RU')}`);
    
    try {
        // Создаем экземпляр сервиса
        const bookWorm = new BookWormService();
        
        // Запускаем полную синхронизацию
        const result = await bookWorm.runFullSync();
        
        console.log('\n🎉 Книжный Червь успешно завершил свою миссию!');
        console.log(`📊 Статистика выполнения:`);
        console.log(`   📚 Метаданные - Обработано: ${result.metadata.processed}, Добавлено: ${result.metadata.added}`);
        console.log(`   📁 Файлы - Обработано: ${result.files.processed}, Привязано: ${result.files.linked}`);
        
        // Здесь можно добавить логику для отправки уведомлений или записи в лог
        return result;
    } catch (error) {
        console.error('💥 Книжный Червь столкнулся с непредвиденной ошибкой:', error);
        throw error;
    }
}

/**
 * Запускает Книжного Червя с интервалом
 * @param intervalMinutes Интервал в минутах между запусками
 */
async function runBookWormWithInterval(intervalMinutes: number = 30) {
    console.log(`🐋 Книжный Червь будет запускаться каждые ${intervalMinutes} минут`);
    
    // Запускаем сразу при старте
    await runScheduledBookWorm();
    
    // Устанавливаем интервал для повторных запусков
    setInterval(async () => {
        try {
            await runScheduledBookWorm();
        } catch (error) {
            console.error('❌ Ошибка при запуске Книжного Червя по расписанию:', error);
        }
    }, intervalMinutes * 60 * 1000); // Преобразуем минуты в миллисекунды
}

// Если скрипт запущен напрямую, начинаем выполнение
if (require.main === module) {
    // По умолчанию запускаем каждые 30 минут
    const interval = process.env.BOOK_WORM_INTERVAL ? parseInt(process.env.BOOK_WORM_INTERVAL, 10) : 30;
    runBookWormWithInterval(interval).catch(console.error);
}

export { runScheduledBookWorm, runBookWormWithInterval };