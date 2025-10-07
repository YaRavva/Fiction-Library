import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function testBookDeduplication() {
  try {
    console.log('🔍 Тестирование дедупликации книг\n');
    
    // Проверим несколько примеров книг, которые уже существуют в базе
    const testBooks = [
      { title: 'цикл Шаман', author: 'Константин Калбазов' },
      { title: 'цикл Корабль во фьорде', author: 'Елизавета Дворецкая' },
      { title: 'цикл Луна', author: 'Йен Макдональд' }
    ];
    
    for (const book of testBooks) {
      console.log(`\n🔍 Проверяем книгу: "${book.title}" автора ${book.author}`);
      
      // @ts-ignore
      const { data: foundBooks, error: findError } = await supabaseAdmin
        .from('books')
        .select('id, title, author, cover_url')
        .eq('title', book.title)
        .eq('author', book.author);
        
      if (findError) {
        console.error(`  ❌ Ошибка при поиске книги:`, findError.message);
        continue;
      }
      
      if (foundBooks && foundBooks.length > 0) {
        const existingBook = foundBooks[0];
        console.log(`  ✅ Книга найдена в базе данных`);
        console.log(`     ID: ${existingBook.id}`);
        console.log(`     Обложка: ${existingBook.cover_url || 'Нет'}`);
      } else {
        console.log(`  ℹ️ Книга не найдена в базе данных`);
      }
    }
    
    // Проверим общее количество книг в базе
    console.log('\n📊 Общая статистика:');
    // @ts-ignore
    const { count: totalBooks, error: countError } = await supabaseAdmin
      .from('books')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error(`  ❌ Ошибка при подсчете книг:`, countError.message);
    } else {
      console.log(`  Всего книг в базе: ${totalBooks}`);
    }
    
    // Проверим количество обработанных сообщений
    // @ts-ignore
    const { count: processedMessages, error: messagesError } = await supabaseAdmin
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true });
      
    if (messagesError) {
      console.error(`  ❌ Ошибка при подсчете сообщений:`, messagesError.message);
    } else {
      console.log(`  Обработанных сообщений: ${processedMessages}`);
    }
    
    console.log('\n✅ Тест завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании дедупликации:', error);
    process.exit(1);
  }
}

testBookDeduplication();