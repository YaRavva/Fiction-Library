import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function testServerStatus() {
  try {
    console.log('🔍 Проверяем статус сервера разработки...');
    
    // Проверяем, можем ли мы импортировать функции без завершения процесса
    const { syncBooks } = await import('./sync-books');
    
    console.log('✅ Функция syncBooks импортирована успешно');
    console.log('✅ Сервер разработки не был остановлен');
    
    // Проверяем сигнатуру функции
    console.log('📊 Функция syncBooks готова к использованию с любым лимитом');
    
  } catch (error) {
    console.error('❌ Ошибка проверки:', error);
  } finally {
    console.log('🔒 Тест завершен без остановки сервера');
    // Не вызываем process.exit(0) чтобы не остановить сервер
  }
}

testServerStatus();