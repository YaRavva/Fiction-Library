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
  telegram_post_id?: number // Изменено на number
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
  
  // Сначала проверяем существующую запись по автору и названию (точное совпадение)
  if (book.title && book.author) {
    const { data: existingBook, error: fetchError } = await admin
      .from('books')
      .select('id, title, author')
      .eq('title', book.title)
      .eq('author', book.author)
      .single();
    
    if (!fetchError && existingBook) {
      console.log(`✅ Найдена существующая книга (точное совпадение): ${(existingBook as { id: string }).id}`);
      // Обновляем существующую запись, добавляя информацию о файле
      const updateData: Partial<Book> = {};
      
      // Копируем только те поля, которые есть в новой записи
      if (book.file_url) updateData.file_url = book.file_url;
      if (book.file_size) updateData.file_size = book.file_size;
      if (book.file_format) updateData.file_format = book.file_format;
      if (book.telegram_file_id) updateData.telegram_file_id = book.telegram_file_id;
      if (book.telegram_post_id) updateData.telegram_post_id = book.telegram_post_id; // Добавляем обработку telegram_post_id
      if (book.storage_path) updateData.storage_path = book.storage_path;
      
      // Обновляем только если есть новые данные
      if (Object.keys(updateData).length > 0) {
        // Type assertion to fix typing issues with Supabase client
        const typedAdmin = admin as unknown as {
          from: (table: string) => {
            update: (data: Record<string, unknown>) => {
              eq: (column: string, value: unknown) => {
                select: () => {
                  single: () => Promise<{ data: unknown; error: unknown }>;
                };
              };
            };
          };
        };
        
        const { data, error } = await typedAdmin
          .from('books')
          .update(updateData)
          .eq('id', (existingBook as { id: string }).id)
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
      console.log(`⚠️  Книга не найдена по точному совпадению`);
      if (fetchError) {
        console.log(`  Ошибка поиска: ${fetchError.message}`);
      }
    }
    
    // Если точное совпадение не найдено, пробуем поиск с релевантностью
    console.log(`🔍 Пробуем поиск с релевантностью для: title="${book.title}", author="${book.author}"`);
    
    // Разбиваем автора и название на слова для поиска
    const titleWords = (book.title || '').split(/\s+/).filter(word => word.length > 2);
    const authorWords = (book.author || '').split(/\s+/).filter(word => word.length > 2);
    const allSearchWords = [...titleWords, ...authorWords].filter(word => word.length > 0);
    
    console.log(`  Слова для поиска: [${allSearchWords.join(', ')}]`);
    
    if (allSearchWords.length > 0) {
      // Ищем книги, где в названии или авторе встречаются слова из поискового запроса
      const searchPromises = allSearchWords.map(async (word) => {
        const { data: titleMatches } = await admin
          .from('books')
          .select('id, title, author')
          .ilike('title', `%${word}%`)
          .limit(5);
        
        const { data: authorMatches } = await admin
          .from('books')
          .select('id, title, author')
          .ilike('author', `%${word}%`)
          .limit(5);
        
        const allMatches = [...(titleMatches || []), ...(authorMatches || [])];
        
        // Удаляем дубликаты по ID
        const uniqueMatches = allMatches.filter((bookItem, index, self) => 
          index === self.findIndex(b => (b as { id: string }).id === (bookItem as { id: string }).id)
        );
        
        return uniqueMatches;
      });
      
      // Выполняем все поисковые запросы параллельно
      const results = await Promise.all(searchPromises);
      
      // Объединяем все результаты
      const allMatches = results.flat();
      
      // Удаляем дубликаты по ID
      const uniqueMatches = allMatches.filter((bookItem, index, self) => 
        index === self.findIndex(b => (b as { id: string }).id === (bookItem as { id: string }).id)
      );
      
      // Сортируем по релевантности (по количеству совпадений)
      const matchesWithScores = uniqueMatches.map(bookItem => {
        const typedBookItem = bookItem as { id: string; title: string; author: string };
        const bookTitleWords = typedBookItem.title.toLowerCase().split(/\s+/);
        const bookAuthorWords = typedBookItem.author.toLowerCase().split(/\s+/);
        const allBookWords = [...bookTitleWords, ...bookAuthorWords];
        
        // Считаем количество совпадений поисковых слов с словами в книге
        let score = 0;
        for (const searchWord of allSearchWords) {
          const normalizedSearchWord = searchWord.toLowerCase();
          let found = false;
          for (const bookWord of allBookWords) {
            const normalizedBookWord = bookWord.toLowerCase();
            // Проверяем точное совпадение или частичное включение
            if (normalizedBookWord.includes(normalizedSearchWord) || normalizedSearchWord.includes(normalizedBookWord)) {
              score++;
              found = true;
              break; // Не увеличиваем счетчик больше одного раза для одного поискового слова
            }
          }
        }
        
        return { ...typedBookItem, score };
      });
      
      // Сортируем по убыванию счета
      matchesWithScores.sort((a, b) => b.score - a.score);
      
      // Берем только лучшие совпадения и фильтруем по минимальной релевантности
      const topMatches = matchesWithScores.slice(0, 5);
      
      // Возвращаем массив совпадений с релевантностью >= 2
      const relevantMatches = topMatches.filter(match => match.score >= 2);
      if (relevantMatches.length > 0) {
        console.log(`✅ Найдено ${relevantMatches.length} релевантных совпадений:`);
        relevantMatches.forEach((match, index) => {
          console.log(`  ${index + 1}. "${match.title}" автора ${match.author} (релевантность: ${match.score})`);
        });
        return relevantMatches;
      } else {
        console.log(`⚠️  Релевантные совпадения не найдены`);
      }
    } else {
      console.log(`⚠️  Недостаточно слов для поиска с релевантностью`);
    }
  }
  
  // Если книга не найдена по релевантности, создаем новую запись
  console.log(`➕ Создаем новую книгу: title="${book.title}", author="${book.author}"`);
  const { data: newBook, error: insertError } = await admin
    .from('books')
    .insert(book as any) // Приводим к any для обхода проблемы с типами
    .select()
    .single();

  if (insertError) throw insertError;

  console.log(`✅ Новая книга создана: ${(newBook as { id: string }).id}`);
  return newBook;
}
