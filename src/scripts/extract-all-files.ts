import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { BookWormService } from '../lib/telegram/book-worm-service';

/**
 * Тестовый скрипт для извлечения всех файлов из канала "Архив для фантастики"
 */
async function extractAllFiles() {
    console.log('📦 Тестовое извлечение всех файлов из канала "Архив для фантастики"');
    console.log(`📅 Время запуска: ${new Date().toLocaleString('ru-RU')}`);
    
    try {
        // Создаем экземпляр сервиса
        const bookWorm = new BookWormService();
        
        // Инициализируем сервисы
        await bookWorm['initializeServices'](); // Вызываем приватный метод для инициализации
        
        // Вызываем новую функцию для извлечения всех файлов
        await bookWorm['extractAllFilesFromArchive'](); // Вызываем приватный метод для тестирования
        
        console.log('\n🎉 Извлечение файлов успешно завершено!');
    } catch (error) {
        console.error('💥 Произошла ошибка при извлечении файлов:', error);
        throw error;
    }
}

// Если скрипт запущен напрямую, начинаем выполнение
if (require.main === module) {
    extractAllFiles().catch(console.error);
}

export { extractAllFiles };