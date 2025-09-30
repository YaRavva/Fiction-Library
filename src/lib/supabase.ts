import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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