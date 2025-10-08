import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { TelegramService } from '../lib/telegram/client';

async function checkMessageAvailability() {
    console.log('🔍 Проверка доступности сообщений...');
    
    try {
        // Получаем экземпляр TelegramService
        const telegramClient = await TelegramService.getInstance();
        
        // Получаем канал с файлами
        console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
        const channel = await telegramClient.getFilesChannel();
        
        // Тестовые ID сообщений для проверки
        const testMessageIds = [4775, 4754, 4611, 4490, 4491];
        
        for (const messageId of testMessageIds) {
            console.log(`\n📥 Проверка сообщения ${messageId}...`);
            
            try {
                // Попробуем получить сообщение по ID
                const messages = await telegramClient.getMessages(channel, 1, messageId) as any[];
                
                if (messages && messages.length > 0) {
                    const message = messages[0];
                    console.log(`  ✅ Сообщение найдено`);
                    
                    // Проверим, что сообщение не пустое
                    if (message) {
                        console.log(`  📋 Структура сообщения:`, Object.keys(message || {}));
                        
                        // Проверим наличие медиа
                        if (message.media) {
                            console.log(`  📎 Сообщение содержит медиа`);
                        } else if (message.document) {
                            console.log(`  📄 Сообщение содержит документ`);
                        } else if (message.photo) {
                            console.log(`  📸 Сообщение содержит фото`);
                        } else {
                            console.log(`  ⚠️  Сообщение не содержит медиа`);
                        }
                    } else {
                        console.log(`  ⚠️  Сообщение пустое`);
                    }
                } else {
                    console.log(`  ❌ Сообщение не найдено`);
                }
            } catch (error) {
                console.error(`  ❌ Ошибка при получении сообщения ${messageId}:`, error);
            }
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
checkMessageAvailability().catch(console.error);