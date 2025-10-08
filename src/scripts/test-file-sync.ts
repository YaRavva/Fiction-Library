import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { Book WormService } from '../lib/telegram/book-worm-service';

async function testFileSync() {
    console.log('🧪 Тестирование синхронизации файлов...');
    
    try {
        // Создаем экземпляр сервиса
        const book-worm = new Book WormService();
        
        // Инициализируем сервисы
        await (book-worm as any).initializeServices();
        
        // Вызываем метод синхронизации файлов напрямую
        console.log('🔍 Запуск синхронизации файлов...');
        const result = await (book-worm as any).syncFiles();
        
        console.log('\n📊 Результаты теста:');
        console.log(`Обработано: ${result.processed}`);
        console.log(`Привязано: ${result.linked}`);
        console.log(`Пропущено: ${result.skipped}`);
        console.log(`Ошибок: ${result.errors}`);
        
        console.log('\n✅ Тест завершен!');
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
        process.exit(1);
    }
}

// Запуск теста
testFileSync().catch(console.error);