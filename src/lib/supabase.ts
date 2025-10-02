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
  checkEnvVars();
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
  const { data, error } = await supabase.from('books').upsert(book).select().single()
  if (error) throw error
  return data
}