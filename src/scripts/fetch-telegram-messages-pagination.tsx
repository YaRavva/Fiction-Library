// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

import { TelegramService } from '../lib/telegram/client';

async function fetchTelegramMessagesWithPagination() {
    console.log('=== ПОЛУЧЕНИЕ СООБЩЕНИЙ С ПАГИНАЦИЕЙ ===\n');
    
    let client: TelegramService | null = null;
    
    try {
        // Получаем экземпляр Telegram клиента
        console.log('1. Подключение к Telegram...');
        client = await TelegramService.getInstance();
        console.log('   ✅ Подключение установлено');
        
        // Получаем канал с файлами
        console.log('2. Получение доступа к каналу с файлами...');
        const filesChannel = await client.getFilesChannel();
        console.log('   ✅ Доступ к каналу с файлами получен');
        
        // Получаем сообщения с пагинацией
        console.log('3. Получение сообщений с пагинацией...');
        
        let allMessages: any[] = [];
        let offsetId: number | undefined = undefined;
        const batchSize = 100; // Максимальное количество сообщений за запрос
        let batchCount = 0;
        const maxBatches = 3; // Ограничиваем количество батчей для демонстрации
        
        while (batchCount < maxBatches) {
            console.log(`   📦 Получение батча ${batchCount + 1} (offsetId: ${offsetId || 'latest'})...`);
            
            const messages = await client.getMessages(filesChannel, batchSize, offsetId);
            
            if (!messages || messages.length === 0) {
                console.log('   ⚠️  Больше сообщений нет');
                break;
            }
            
            console.log(`   ✅ Получено ${messages.length} сообщений`);
            allMessages = [...allMessages, ...messages];
            
            // Устанавливаем offsetId для следующего запроса
            // Используем ID самого старого сообщения в текущем батче
            const oldestMessage = messages[messages.length - 1];
            offsetId = oldestMessage.id;
            
            batchCount++;
            
            // Показываем информацию о первых нескольких сообщениях в батче
            console.log(`   📋 Первые 3 сообщения из батча:`);
            for (let i = 0; i < Math.min(3, messages.length); i++) {
                const msg = messages[i];
                if (msg.document) {
                    // Ищем имя файла
                    let filename = 'unknown';
                    if (msg.document.attributes) {
                        const fileNameAttr = msg.document.attributes.find((attr: any) => 
                            attr.className === 'DocumentAttributeFilename'
                        );
                        if (fileNameAttr && (fileNameAttr as any).fileName) {
                            filename = (fileNameAttr as any).fileName;
                        }
                    }
                    console.log(`      ${msg.id}: ${filename}`);
                } else {
                    console.log(`      ${msg.id}: текстовое сообщение`);
                }
            }

            console.log('   ' + '─'.repeat(50));
        }
        
        console.log(`\n📊 Всего получено сообщений: ${allMessages.length}`);
        
        // Отключаемся
        if (client && typeof (client as any).disconnect === 'function') {
            await (client as any).disconnect();
            console.log('\n4. Отключение от Telegram...');
            console.log('   ✅ Отключение выполнено');
        }
        
        console.log('\n=== ПОЛУЧЕНИЕ ЗАВЕРШЕНО ===');
        
    } catch (error) {
        console.error('❌ Ошибка при получении сообщений:', error);
        
        // Отключаемся в случае ошибки
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

fetchTelegramMessagesWithPagination().catch(console.error);