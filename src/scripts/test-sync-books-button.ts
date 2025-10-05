import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function testSyncBooksButton() {
  try {
    console.log('🚀 Тестируем кнопку "Синхронизировать книги" с лимитом 100...');
    
    // Симулируем вызов API, который делает кнопка
    const response = await fetch('http://localhost:3000/api/admin/sync-books', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 100
      })
    });
    
    const data = await response.json();
    
    console.log('📊 Результат вызова API:');
    console.log(`Статус: ${response.status}`);
    console.log(`Сообщение: ${data.message}`);
    console.log(`Успешно: ${data.success}`);
    
    if (data.limit) {
      console.log(`Лимит: ${data.limit}`);
    }
    
    // Проверяем статус через некоторое время
    console.log('\n⏳ Ждем 2 секунды и проверяем статус...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await fetch('http://localhost:3000/api/admin/sync-books', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const statusData = await statusResponse.json();
    
    console.log('\n📊 Статус синхронизации:');
    if (statusData.success && statusData.status) {
      console.log(`Запущена: ${statusData.status.isRunning ? 'Да' : 'Нет'}`);
      console.log(`Сообщение: ${statusData.status.message}`);
      if (statusData.status.startTime) {
        const startTime = new Date(statusData.status.startTime);
        console.log(`Время начала: ${startTime.toLocaleString()}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования кнопки:', error);
  } finally {
    // Принудительно завершаем процесс через 1 секунду
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 1000);
  }
}

testSyncBooksButton();