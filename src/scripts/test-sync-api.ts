import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function testSyncApi() {
  try {
    console.log('🚀 Тестируем API синхронизации книг...');
    
    // Тестируем GET запрос (получение статуса)
    console.log('\n🔍 Тестируем GET запрос (статус):');
    const getStatusResponse = await fetch('http://localhost:3000/api/admin/sync-books', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const getStatusData = await getStatusResponse.json();
    console.log('Статус ответа:', getStatusResponse.status);
    console.log('Данные:', JSON.stringify(getStatusData, null, 2));
    
    // Тестируем POST запрос (запуск синхронизации)
    console.log('\n🚀 Тестируем POST запрос (запуск синхронизации):');
    const postResponse = await fetch('http://localhost:3000/api/admin/sync-books', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 3 })
    });
    
    const postData = await postResponse.json();
    console.log('Статус ответа:', postResponse.status);
    console.log('Данные:', JSON.stringify(postData, null, 2));
    
    // Снова проверяем статус
    console.log('\n🔍 Повторно проверяем статус:');
    const getStatusResponse2 = await fetch('http://localhost:3000/api/admin/sync-books', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const getStatusData2 = await getStatusResponse2.json();
    console.log('Статус ответа:', getStatusResponse2.status);
    console.log('Данные:', JSON.stringify(getStatusData2, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка тестирования API:', error);
  } finally {
    // Принудительно завершаем процесс через 1 секунду
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 1000);
  }
}

testSyncApi();