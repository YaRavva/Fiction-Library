import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Проверяем переменные окружения только если они действительно нужны
function checkEnvVars() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }
}

// Экспортируем функцию создания клиента для возможности создавать отдельные инстансы
export const createClient = () => {
  // Откладываем проверку переменных окружения до фактического использования
  if (!supabaseUrl || !supabaseAnonKey) {
    checkEnvVars();
  }
  return createSupabaseClient(supabaseUrl!, supabaseAnonKey!);
};

// Ленивая инициализация клиентов
let _supabase: ReturnType<typeof createSupabaseClient> | null = null;
let _supabaseAdmin: ReturnType<typeof createSupabaseClient> | null = null;

// Экспортируем геттер для дефолтного инстанса
export const getSupabase = () => {
  if (!_supabase) {
    checkEnvVars();
    _supabase = createSupabaseClient(supabaseUrl!, supabaseAnonKey!);
  }
  return _supabase;
};

// Экспортируем дефолтный инстанс для обратной совместимости
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(target, prop) {
    return getSupabase()[prop as keyof ReturnType<typeof createSupabaseClient>];
  }
});

// Создаем клиент с service role для серверных операций (загрузка файлов, админские операции)
export const getSupabaseAdmin = () => {
  if (!_supabaseAdmin) {
    // Перечитываем переменные окружения при первом вызове
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && key) {
      _supabaseAdmin = createSupabaseClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
  }
  return _supabaseAdmin;
};

// Экспортируем прокси для обратной совместимости
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(target, prop) {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }
    return admin[prop as keyof ReturnType<typeof createSupabaseClient>];
  }
});

// Types for our database tables
export interface Series {
  id: string
  title: string
  author: string
  description?: string
  rating?: number
  cover_url?: string
  cover_urls?: string[]
  telegram_post_id?: string
  tags: string[]
  genres: string[]
  series_composition?: { title: string; year: number }[]
  created_at: string
  updated_at: string
}

export interface Book {
  id: string
  series_id?: string
  title: string
  author: string
  publication_year?: number
  description?: string
  cover_url?: string
  file_url?: string
  file_size?: number
  file_format: string
  rating?: number
  tags: string[]
  genres: string[]
  series_order?: number
  telegram_file_id?: string
  downloads_count: number
  views_count: number
  created_at: string
  updated_at: string
  storage_path?: string
}

export interface UserProfile {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string
  role: 'reader' | 'admin'
  reading_preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ReadingHistory {
  id: string
  user_id: string
  book_id: string
  last_position: number
  reading_progress: number
  reading_time_minutes: number
  last_read_at: string
  created_at: string
  updated_at: string
}

export interface UserBookmark {
  id: string
  user_id: string
  book_id: string
  position: number
  chapter?: string
  note?: string
  created_at: string
}

export interface UserRating {
  user_id: string
  book_id: string
  rating: number
  review?: string
  created_at: string
  updated_at: string
}

// Upload a buffer to Supabase Storage
// Использует service role для загрузки файлов (требуется для Storage)
export async function uploadFileToStorage(bucket: string, path: string, buffer: Buffer, mimeType = 'application/octet-stream') {
  const admin = getSupabaseAdmin();

  if (!admin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Cannot upload files to storage.');
  }

  const { data, error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  })

  if (error) {
    console.error(`Error uploading file to ${bucket}/${path}:`, error);
    throw error;
  }

  console.log(`✅ Successfully uploaded file to ${bucket}/${path}`);
  return data;
}

// Insert or update a book record
export async function upsertBookRecord(book: Partial<Book>) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Cannot upsert book record.');
  }
  
  console.log(`🔍 Ищем книгу по метаданным: title="${book.title}", author="${book.author}"`);
  
  // Сначала проверяем существующую запись по автору и названию
  if (book.title && book.author) {
    const { data: existingBook, error: fetchError } = await (admin as any)
      .from('books')
      .select('id')
      .eq('title', book.title)
      .eq('author', book.author)
      .single();
    
    if (!fetchError && existingBook) {
      console.log(`✅ Найдена существующая книга: ${existingBook.id}`);
      // Обновляем существующую запись, добавляя информацию о файле
      const updateData: Partial<Book> = {};
      
      // Копируем только те поля, которые есть в новой записи
      if (book.file_url) updateData.file_url = book.file_url;
      if (book.file_size) updateData.file_size = book.file_size;
      if (book.file_format) updateData.file_format = book.file_format;
      if (book.telegram_file_id) updateData.telegram_file_id = book.telegram_file_id;
      if (book.storage_path) updateData.storage_path = book.storage_path;
      
      // Обновляем только если есть новые данные
      if (Object.keys(updateData).length > 0) {
        const { data, error } = await (admin as any)
          .from('books')
          .update(updateData)
          .eq('id', existingBook.id)
          .select()
          .single();
        
        if (error) throw error;
        console.log(`✅ Книга обновлена с информацией о файле`);
        return data;
      }
      
      // Если нет новых данных, возвращаем существующую запись
      console.log(`ℹ️  Книга уже имеет всю необходимую информацию`);
      return existingBook;
    } else {
      console.log(`⚠️  Книга не найдена по метаданным`);
      if (fetchError) {
        console.log(`  Ошибка поиска: ${fetchError.message}`);
      }
    }
    
    // Если книги не существует, возвращаем null, чтобы файл не загружался
    return null;
  }
  
  console.log(`⚠️  Недостаточно метаданных для поиска книги`);
  
  // Если есть telegram_file_id, пытаемся найти существующую запись для обновления
  if (book.telegram_file_id) {
    console.log(`🔍 Ищем книгу по telegram_file_id: ${book.telegram_file_id}`);
    const { data: existingBook, error: fetchError } = await (admin as any)
      .from('books')
      .select('id')
      .eq('telegram_file_id', book.telegram_file_id)
      .single();
    
    if (!fetchError && existingBook) {
      console.log(`✅ Найдена существующая книга по telegram_file_id: ${existingBook.id}`);
      // Обновляем существующую запись
      const { data, error } = await (admin as any)
        .from('books')
        .update(book)
        .eq('id', existingBook.id)
        .select()
        .single();
      
      if (error) throw error;
      console.log(`✅ Книга обновлена по telegram_file_id`);
      return data;
    } else {
      console.log(`⚠️  Книга не найдена по telegram_file_id`);
      if (fetchError) {
        console.log(`  Ошибка поиска: ${fetchError.message}`);
      }
    }
  }
  
  // Если нет метаданных для поиска, возвращаем null
  console.log(`⚠️  Нет метаданных для поиска книги`);
  return null;
}
