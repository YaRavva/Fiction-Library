import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env' });

async function checkFileExists() {
  try {
    // Create Supabase client directly with environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Проверим наличие файла 4379.zip в бакете
    console.log('Проверяем наличие файла 4379.zip в бакете books...');
    
    try {
      const { data: fileInfo, error: infoError } = await supabaseAdmin.storage
        .from('books')
        .list('', {
          search: '4379.zip'
        });
      
      if (infoError) {
        console.error('Ошибка при получении информации о файле:', infoError.message);
        return;
      }
      
      if (fileInfo && fileInfo.length > 0) {
        console.log(`✅ Файл найден в бакете:`);
        fileInfo.forEach((file: any) => {
          console.log(`  - Имя: ${file.name}`);
          console.log(`  - Размер: ${file.metadata?.size || 'неизвестно'} байт`);
          console.log(`  - Дата создания: ${file.created_at}`);
        });
      } else {
        console.log('❌ Файл 4379.zip не найден в бакете');
      }
    } catch (error) {
      console.error('❌ Ошибка при проверке файла:', error);
    }
    
    // Также проверим, привязан ли файл к какой-либо книге
    console.log('\nПроверяем, привязан ли файл к книге...');
    
    try {
      const { data: books, error: booksError } = await supabaseAdmin
        .from('books')
        .select('id, title, author, storage_path, file_url')
        .ilike('storage_path', '%4379.zip');
      
      if (booksError) {
        console.error('Ошибка при поиске книг:', booksError.message);
        return;
      }
      
      if (books && books.length > 0) {
        console.log(`✅ Найдены книги с привязкой к файлу 4379.zip:`);
        books.forEach((book: any) => {
          console.log(`  - ID: ${book.id}`);
          console.log(`    Название: ${book.title}`);
          console.log(`    Автор: ${book.author}`);
          console.log(`    Путь хранения: ${book.storage_path}`);
          console.log(`    URL файла: ${book.file_url}`);
        });
      } else {
        console.log('❌ Нет книг с привязкой к файлу 4379.zip');
      }
    } catch (error) {
      console.error('❌ Ошибка при поиске книг:', error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

checkFileExists();