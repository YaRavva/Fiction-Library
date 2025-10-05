import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function checkBooksStructure() {
  try {
    console.log('🔍 Проверка структуры таблицы books...');
    
    // Получаем информацию о структуре таблицы
    const { data, error } = await (serverSupabase as any)
      .from('books')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Ошибка при получении структуры таблицы:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ Таблица books пуста');
      return;
    }
    
    const book = data[0];
    console.log('Структура таблицы books:');
    console.log(Object.keys(book));
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

checkBooksStructure();