import { TelegramSyncService } from '../lib/telegram/sync';

// Тестовое сообщение с файлом
const testMessage: any = {
    id: 12345,
    document: {
        attributes: [
            {
                className: 'DocumentAttributeFilename',
                fileName: 'Вилма Кадлечкова - Мицелий.zip'
            }
        ]
    }
};

async function testSingleFileProcess() {
    console.log('Тестируем обработку одного файла...\n');
    
    // Проверяем извлечение метаданных из имени файла
    const filename = 'Вилма Кадлечкова - Мицелий.zip';
    const metadata = TelegramSyncService.extractMetadataFromFilename(filename);
    
    console.log(`Имя файла: ${filename}`);
    console.log(`Извлеченные метаданные:`);
    console.log(`  Автор: ${metadata.author}`);
    console.log(`  Название: ${metadata.title}`);
    
    console.log('\n---\n');
    
    // Проверяем работу с тестовым сообщением
    console.log('Имитация обработки файла из Telegram...');
    console.log(`ID сообщения: ${testMessage.id}`);
    
    if (testMessage.document && testMessage.document.attributes) {
        const attrFileName = testMessage.document.attributes.find((attr: any) => 
            attr.className === 'DocumentAttributeFilename'
        );
        if (attrFileName && attrFileName.fileName) {
            const filenameCandidate = attrFileName.fileName;
            console.log(`Имя файла: ${filenameCandidate}`);
            
            const metadata = TelegramSyncService.extractMetadataFromFilename(filenameCandidate);
            console.log(`Метаданные для поиска в БД:`);
            console.log(`  Автор: "${metadata.author}"`);
            console.log(`  Название: "${metadata.title}"`);
        }
    }
}

testSingleFileProcess().catch(console.error);