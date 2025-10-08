import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { TelegramService } from '../lib/telegram/client';

async function findMessageById() {
    console.log('🔍 Поиск сообщения по ID...');
    
    try {
        // Получаем экземпляр TelegramService
        const telegramClient = await TelegramService.getInstance();
        
        // Получаем канал с файлами
        console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
        const channel = await telegramClient.getFilesChannel();
        
        // Тестовый ID сообщения для проверки
        const testMessageId = 4775;
        console.log(`\n📥 Поиск сообщения ${testMessageId}...`);
        
        try {
            // Получаем несколько сообщений и ищем нужное среди них
            // Это подход из sync.ts, который может работать лучше
            const messages = await telegramClient.getMessages(channel, 20) as any[];
            
            console.log(`  ✅ Получено ${messages.length} сообщений`);
            
            // Ищем сообщение с нужным ID
            let targetMessage = null;
            for (const msg of messages) {
                if (msg && msg.id === testMessageId) {
                    targetMessage = msg;
                    break;
                }
            }
            
            if (targetMessage) {
                console.log(`  📨 Найдено сообщение с ID ${testMessageId}`);
                console.log(`  📋 Структура сообщения:`, Object.keys(targetMessage || {}));
                
                // Проверим наличие медиа
                if (targetMessage.media) {
                    console.log(`  📎 Сообщение содержит медиа`);
                } else if (targetMessage.document) {
                    console.log(`  📄 Сообщение содержит документ`);
                } else if (targetMessage.photo) {
                    console.log(`  📸 Сообщение содержит фото`);
                } else {
                    console.log(`  ⚠️  Сообщение не содержит медиа`);
                }
            } else {
                console.log(`  ❌ Сообщение с ID ${testMessageId} не найдено среди полученных сообщений`);
                
                // Выведем ID всех полученных сообщений для анализа
                console.log(`  📋 ID полученных сообщений:`);
                for (const msg of messages) {
                    if (msg && msg.id) {
                        console.log(`    - ${msg.id}`);
                    }
                }
            }
        } catch (error) {
            console.error(`  ❌ Ошибка при получении сообщений:`, error);
        }
    } catch (error) {
        console.error('❌ Общая ошибка:', error);
    } finally {
        // Завершаем работу клиента
        try {
            const telegramClient = await TelegramService.getInstance();
            await telegramClient.disconnect();
            console.log('\n🔌 Клиент Telegram отключен');
        } catch (shutdownError) {
            console.error('⚠️ Ошибка при отключении клиента:', shutdownError);
        }
    }
}

// Запуск скрипта
findMessageById().catch(console.error);