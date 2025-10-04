// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

import { TelegramService } from '../lib/telegram/client';
import { TelegramSyncService } from '../lib/telegram/sync';

async function checkTelegramAccess() {
    console.log('=== ПРОВЕРКА ДОСТУПА К TELEGRAM ===\n');
    
    try {
        // Получаем экземпляр Telegram клиента
        console.log('1. Подключение к Telegram...');
        const client = await TelegramService.getInstance();
        console.log('   ✅ Подключение установлено');
        
        // Получаем канал с файлами
        console.log('2. Получение доступа к каналу с файлами...');
        const filesChannel = await client.getFilesChannel();
        console.log('   ✅ Доступ к каналу с файлами получен');
        console.log(`   ID канала: ${filesChannel.id}`);
        
        // Получаем несколько последних сообщений
        console.log('3. Получение последних сообщений из канала...');
        const messages = await client.getMessages(filesChannel, 5);
        console.log(`   ✅ Получено ${messages.length} сообщений`);
        
        // Анализируем сообщения
        console.log('\n4. Анализ сообщений:');
        for (let i = 0; i < messages.length; i++) {
            const msg: any = messages[i];
            console.log(`   Сообщение ${msg.id}:`);
            
            if (msg.document) {
                console.log(`     📄 Документ найден`);
                
                // Ищем имя файла
                if (msg.document.attributes) {
                    const fileNameAttr = msg.document.attributes.find((attr: any) => 
                        attr.className === 'DocumentAttributeFilename'
                    );
                    if (fileNameAttr && fileNameAttr.fileName) {
                        console.log(`     Имя файла: ${fileNameAttr.fileName}`);
                        
                        // Извлекаем метаданные
                        const metadata = TelegramSyncService.extractMetadataFromFilename(fileNameAttr.fileName);
                        console.log(`     Метаданные: Автор="${metadata.author}", Название="${metadata.title}"`);
                    }
                }
            } else {
                console.log(`     📝 Текстовое сообщение`);
            }
            
            if (i < messages.length - 1) {
                console.log('     ---');
            }
        }
        
        // Отключаемся
        if (typeof (client as any).disconnect === 'function') {
            await (client as any).disconnect();
            console.log('\n5. Отключение от Telegram...');
            console.log('   ✅ Отключение выполнено');
        }
        
        console.log('\n=== ПРОВЕРКА ЗАВЕРШЕНА ===');
        
    } catch (error) {
        console.error('❌ Ошибка при проверке доступа к Telegram:', error);
    }
}

checkTelegramAccess().catch(console.error);