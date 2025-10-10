#!/usr/bin/env tsx

/**
 * Проверка переменных окружения для Telegram API
 */

import { config } from 'dotenv';

// Загружаем переменные окружения из .env файла
config();

console.log('🔧 Проверка переменных окружения...\n');

// Проверяем переменные окружения
const requiredEnvVars = [
    'TELEGRAM_API_ID',
    'TELEGRAM_API_HASH',
    'TELEGRAM_SESSION',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
];

let allPresent = true;

for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
        console.log(`✅ ${envVar}: установлен`);
    } else {
        console.log(`❌ ${envVar}: отсутствует`);
        allPresent = false;
    }
}

console.log(`\n📋 Результат: ${allPresent ? 'Все переменные установлены' : 'Отсутствуют некоторые переменные'}`);

if (allPresent) {
    console.log('🚀 Сервис готов к работе с реальными данными!');
} else {
    console.log('⚠️ Необходимо установить отсутствующие переменные окружения');
}

process.exit(0);