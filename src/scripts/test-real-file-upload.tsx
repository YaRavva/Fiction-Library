import { TelegramSyncService } from '../lib/telegram/sync';

async function testRealFileUpload() {
    console.log('Тестируем загрузку реального файла...\n');
    
    try {
        // Создаем экземпляр сервиса синхронизации
        const syncService = await TelegramSyncService.getInstance();
        
        // Тестовое сообщение с реальным файлом (пример)
        const testMessage: any = {
            id: 999999, // Тестовый ID
            document: {
                attributes: [
                    {
                        className: 'DocumentAttributeFilename',
                        fileName: 'Вилма Кадлечкова - Мицелий.zip'
                    }
                ]
            }
        };
        
        console.log(`Имитация обработки файла: ${testMessage.document.attributes[0].fileName}`);
        
        // Вызываем метод обработки одного файла
        // Поскольку у нас нет реального Telegram клиента в этом тесте,
        // мы просто проверим логику извлечения метаданных
        
        const filenameCandidate = testMessage.document.attributes[0].fileName;
        const metadata = TelegramSyncService.extractMetadataFromFilename(filenameCandidate);
        
        console.log(`Извлеченные метаданные:`);
        console.log(`  Автор: "${metadata.author}"`);
        console.log(`  Название: "${metadata.title}"`);
        
        console.log('\n---\n');
        console.log('В реальной ситуации:');
        console.log('1. Файл будет скачан из Telegram');
        console.log('2. Метаданные будут извлечены из имени файла');
        console.log('3. Будет выполнен поиск книги в базе данных по этим метаданным');
        console.log('4. Если книга найдена - файл будет загружен в Storage и привязан к книге');
        console.log('5. Если книга не найдена - файл не будет загружен в Storage');
        
        // Освобождаем ресурсы
        await syncService.shutdown();
        
    } catch (error) {
        console.error('Ошибка при тестировании:', error);
    }
}

testRealFileUpload().catch(console.error);