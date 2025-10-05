import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkSyncStatus() {
  try {
    console.log('🔍 Проверяем статус синхронизации книг...');
    
    // Отправляем GET запрос к API endpoint
    const response = await fetch('http://localhost:3000/api/admin/sync-books', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      const status = data.status;
      console.log('📊 Статус синхронизации:');
      console.log(`  Запущена: ${status.isRunning ? 'Да' : 'Нет'}`);
      console.log(`  Сообщение: ${status.message}`);
      console.log(`  Прогресс: ${status.progress || 0}%`);
      
      if (status.startTime) {
        const startTime = new Date(status.startTime);
        console.log(`  Время начала: ${startTime.toLocaleString()}`);
      }
    } else {
      console.log('❌ Ошибка получения статуса:', data.message);
    }
  } catch (error) {
    console.error('❌ Ошибка проверки статуса синхронизации:', error);
  } finally {
    // Принудительно завершаем процесс через 1 секунду
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 1000);
  }
}

checkSyncStatus();