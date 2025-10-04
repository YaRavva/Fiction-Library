import { TelegramSyncService } from '../lib/telegram/sync';
import { getSupabaseAdmin } from '../lib/supabase';

// Имитация сообщения Telegram с файлом
const mockTelegramMessage: any = {
    id: 123456,
    document: {
        attributes: [
            {
                className: 'DocumentAttributeFilename',
                fileName: 'Вилма Кадлечкова - Мицелий.zip'
            }
        ]
    }
};

async function testFileProcessingLogic() {
    console.log('=== ТЕСТ ЛОГИКИ ОБРАБОТКИ ФАЙЛОВ ===\n');
    
    try {
        // 1. Извлечение имени файла
        let filenameCandidate = 'book_default.fb2';
        if (mockTelegramMessage.document && mockTelegramMessage.document.attributes) {
            const attrFileName = mockTelegramMessage.document.attributes.find((attr: any) => 
                attr.className === 'DocumentAttributeFilename'
            );
            if (attrFileName && attrFileName.fileName) {
                filenameCandidate = attrFileName.fileName;
            }
        }
        
        console.log(`1. Имя файла из Telegram: ${filenameCandidate}`);
        
        // 2. Извлечение метаданных из имени файла
        const metadata = TelegramSyncService.extractMetadataFromFilename(filenameCandidate);
        console.log(`2. Извлеченные метаданные:`);
        console.log(`   Автор: "${metadata.author}"`);
        console.log(`   Название: "${metadata.title}"`);
        
        // 3. Определение формата файла
        const ext = filenameCandidate.substring(filenameCandidate.lastIndexOf('.')).toLowerCase();
        const allowedFormats: Record<string, string> = {
            '.fb2': 'fb2',
            '.zip': 'zip',
        };
        const fileFormat = allowedFormats[ext] || 'fb2';
        console.log(`3. Формат файла: ${fileFormat}`);
        
        // 4. Создание ключа для Storage
        const storageKey = `${mockTelegramMessage.id}${ext}`;
        console.log(`4. Ключ для Storage: ${storageKey}`);
        
        // 5. Поиск книги в базе данных (имитация)
        console.log(`5. Поиск книги в базе данных...`);
        
        // В реальной ситуации здесь будет запрос к Supabase
        // Для теста просто покажем, что будет отправлено в запросе
        console.log(`   Поиск по:`);
        console.log(`     title = "${metadata.title}"`);
        console.log(`     author = "${metadata.author}"`);
        
        // Имитация результата поиска (предположим, что книга найдена)
        const bookFound = true; // В реальной ситуации это будет результат запроса к БД
        const existingBookId = 'book-uuid-12345'; // ID найденной книги
        
        if (bookFound) {
            console.log(`   ✅ Книга найдена: ID = ${existingBookId}`);
            console.log(`   📤 Файл будет загружен в Storage с ключом: ${storageKey}`);
            console.log(`   🔗 Файл будет привязан к книге с ID: ${existingBookId}`);
        } else {
            console.log(`   ⚠️  Книга не найдена`);
            console.log(`   🚫 Файл НЕ будет загружен в Storage`);
        }
        
        console.log('\n=== ТЕСТ ЗАВЕРШЕН ===');
        
    } catch (error) {
        console.error('Ошибка при тестировании:', error);
    }
}

testFileProcessingLogic().catch(console.error);