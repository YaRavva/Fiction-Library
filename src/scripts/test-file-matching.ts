import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { Book WormService } from '../lib/telegram/book-worm-service';

async function testFileMatching() {
    console.log('🧪 Тестирование алгоритма сопоставления файлов...');
    
    try {
        // Создаем экземпляр сервиса
        const book-worm = new Book WormService();
        
        // Тестируем алгоритм поиска соответствий
        const testBook = {
            id: 'test-id',
            title: 'Мир Перекрёстка',
            author: 'Unknown',
            telegram_post_id: '123'
        };
        
        // Тестовые файлы
        const testFiles = [
            { filename: 'Том_Светерлич_Исчезнувший_мир_(2018)_(2020).fb2', messageId: '100' },
            { filename: 'Unknown_Мир_Перекрёстка.fb2', messageId: '101' },
            { filename: 'Другой_автор_Другая_книга.fb2', messageId: '102' }
        ];
        
        // Здесь мы бы вызвали метод findMatchingFile, но он приватный
        // Вместо этого запустим полную синхронизацию для тестирования
        console.log('🔍 Запуск тестовой синхронизации файлов...');
        
        // Инициализируем сервисы
        await (book-worm as any).initializeServices();
        
        // Вызываем метод синхронизации файлов напрямую
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
testFileMatching().catch(console.error);