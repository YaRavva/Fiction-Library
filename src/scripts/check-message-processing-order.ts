import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { TelegramMetadataService } from '../lib/telegram/metadata-service';
import { serverSupabase } from '../lib/serverSupabase';

interface ProcessedMessage {
    message_id: string;
    processed_at: string;
}

async function checkMessageProcessingOrder() {
    console.log('🔍 Проверка порядка обработки сообщений...');
    
    try {
        // Получаем последние 10 обработанных сообщений
        const { data: lastProcessed, error } = await serverSupabase
            .from('telegram_processed_messages')
            .select('message_id, processed_at')
            .order('processed_at', { ascending: false })
            .limit(10);
            
        if (error) {
            console.error('❌ Ошибка при получении обработанных сообщений:', error);
            return;
        }
        
        console.log('📊 Последние 10 обработанных сообщений:');
        if (lastProcessed && lastProcessed.length > 0) {
            for (const msg of lastProcessed) {
                const typedMsg = msg as ProcessedMessage;
                console.log(`  - Message ID: ${typedMsg.message_id}, Processed at: ${typedMsg.processed_at}`);
            }
        } else {
            console.log('  Нет обработанных сообщений');
        }
        
        // Проверяем, как работает пагинация в Telegram
        console.log('\n📡 Проверка пагинации Telegram...');
        const metadataService = await TelegramMetadataService.getInstance();
        
        // Здесь можно добавить логику для проверки порядка получения сообщений
        console.log('  Проверка пагинации еще не реализована');
        
    } catch (error) {
        console.error('❌ Общая ошибка:', error);
    }
}

// Запуск скрипта
checkMessageProcessingOrder().catch(console.error);