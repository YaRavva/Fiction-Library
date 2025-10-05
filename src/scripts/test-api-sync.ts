import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function testApiSync() {
  try {
    console.log('🚀 Тестируем API синхронизации книг...');
    
    const response = await fetch('http://localhost:3000/api/admin/sync-books', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 5
      })
    });
    
    const data = await response.json();
    console.log('✅ Ответ API:', data);
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании API:', error);
  }
}

testApiSync();