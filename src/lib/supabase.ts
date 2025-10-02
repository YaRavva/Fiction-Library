import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Экспортируем функцию создания клиента для возможности создавать отдельные инстансы
export const createClient = () => {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
};

// Экспортируем дефолтный инстанс для обратной совместимости
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

// Types for our database tables
export interface Series {
  id: string
  title: string
  author: string
  description?: string
  rating?: number
  cover_url?: string
  telegram_post_id?: string
  tags: string[]
  genres: string[]
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
export async function uploadFileToStorage(bucket: string, path: string, buffer: Buffer, mimeType = 'application/octet-stream') {
  const { data, error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  })

  if (error) throw error
  return data
}

// Insert or update a book record
export async function upsertBookRecord(book: Partial<Book>) {
  const { data, error } = await supabase.from('books').upsert(book).select().single()
  if (error) throw error
  return data
}