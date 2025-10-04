// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

import { TelegramService } from '../lib/telegram/client';
import { TelegramSyncService } from '../lib/telegram/sync';

async function testAttachKnownBook() {
    console.log('=== ТЕСТ ПРИВЯЗКИ ФАЙЛА К ИЗВЕСТНОЙ КНИГЕ ===\n');
    
    let client: TelegramService | null = null;
    let syncService: TelegramSyncService | null = null;
    
    try {
        // Получаем экземпляр Telegram клиента
        console.log('1. Подключение к Telegram...');
        client = await TelegramService.getInstance();
        console.log('   ✅ Подключение установлено');
        
        // Получаем канал с файлами
        console.log('2. Получение доступа к каналу с файлами...');
        const filesChannel = await client.getFilesChannel();
        console.log('   ✅ Доступ к каналу с файлами получен');
        
        // Получаем одно сообщение с файлом
        console.log('3. Получение сообщения с файлом...');
        const messages = await client.getMessages(filesChannel, 1);
        
        if (messages.length === 0) {
            console.log('   ⚠️  Нет сообщений в канале');
            return;
        }
        
        const msg: any = messages[0];
        console.log(`   ✅ Получено сообщение ID: ${msg.id}`);
        
        if (!msg.document) {
            console.log('   ⚠️  Сообщение не содержит документ');
            return;
        }
        
        // Ищем имя файла
        let filename = 'unknown.fb2';
        if (msg.document.attributes) {
            const fileNameAttr = msg.document.attributes.find((attr: any) => 
                attr.className === 'DocumentAttributeFilename'
            );
            if (fileNameAttr && fileNameAttr.fileName) {
                filename = fileNameAttr.fileName;
            }
        }
        
        console.log(`   📄 Файл: ${filename}`);
        
        // Создаем экземпляр сервиса синхронизации
        syncService = await TelegramSyncService.getInstance();
        
        // Используем известный ID книги "цикл Мицелий" автора Вилма Кадлечкова
        const bookId = 'f419281e-4f7e-4515-a4f7-7594f2685a1d';
        console.log(`   📚 ID книги для привязки: ${bookId}`);
        
        // Загружаем и привязываем файл
        console.log(`\n4. 📤 Загрузка и привязка файла...`);
        try {
            const result = await syncService.processFile(msg, bookId);
            console.log(`   ✅ Файл успешно загружен и привязан к книге`);
            console.log(`   📊 Результат:`);
            console.log(`      Message ID: ${result.messageId}`);
            console.log(`      Filename: ${result.filename}`);
            console.log(`      File size: ${result.fileSize} bytes`);
            console.log(`      Book ID: ${result.bookId}`);
        } catch (processError) {
            console.log(`   ❌ Ошибка при загрузке/привязке файла: ${processError}`);
        }
        
        // Отключаемся
        await syncService.shutdown();
        if (client && typeof (client as any).disconnect === 'function') {
            await (client as any).disconnect();
            console.log('\n5. Отключение от Telegram...');
            console.log('   ✅ Отключение выполнено');
        }
        
        console.log('\n=== ТЕСТ ЗАВЕРШЕН ===');
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
        
        // Отключаемся в случае ошибки
        if (syncService) {
            try {
                await syncService.shutdown();
            } catch (shutdownError) {
                console.log('   ⚠️  Ошибка при отключении сервиса синхронизации:', shutdownError);
            }
        }
        
        if (client && typeof (client as any).disconnect === 'function') {
            try {
                await (client as any).disconnect();
                console.log('   ✅ Отключение выполнено');
            } catch (disconnectError) {
                console.log('   ⚠️  Ошибка при отключении:', disconnectError);
            }
        }
    }
}

testAttachKnownBook().catch(console.error);