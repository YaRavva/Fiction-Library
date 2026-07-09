export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      books: {
        Row: {
          id: string
          series_id: string | null
          title: string
          author: string
          publication_year: number | null
          description: string | null
          cover_url: string | null
          cover_urls: string[] | null
          file_url: string | null
          file_size: number | null
          file_format: string | null
          rating: number | null
          tags: string[] | null
          genres: string[] | null
          series_order: number | null
          telegram_file_id: number | null
          telegram_post_id: number | null
          downloads_count: number | null
          views_count: number | null
          created_at: string | null
          updated_at: string | null
          metadata_processed: boolean | null
          embedding: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["books"]["Row"]> & { title: string; author: string }
        Update: Partial<Database["public"]["Tables"]["books"]["Row"]>
      }
      series: {
        Row: {
          id: string
          title: string
          author: string
          description: string | null
          rating: number | null
          cover_url: string | null
          cover_urls: string[] | null
          telegram_post_id: number | null
          tags: string[] | null
          genres: string[] | null
          series_composition: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["series"]["Row"]> & { title: string; author: string }
        Update: Partial<Database["public"]["Tables"]["series"]["Row"]>
      }
      user_profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          role: string | null
          reading_preferences: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["user_profiles"]["Row"]> & { id: string }
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Row"]>
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          email: string | null
          role: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>
      }
      sync_job_results: {
        Row: {
          id: string
          job_type: string | null
          status: string | null
          started_at: string | null
          completed_at: string | null
          metadata_processed: number | null
          metadata_added: number | null
          metadata_updated: number | null
          metadata_skipped: number | null
          metadata_errors: number | null
          files_processed: number | null
          files_linked: number | null
          files_skipped: number | null
          files_errors: number | null
          error_message: string | null
          log_output: string | null
          details: Json | null
          created_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["sync_job_results"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["sync_job_results"]["Row"]>
      }
      auto_update_settings: {
        Row: {
          id: number
          enabled: boolean | null
          interval: number | null
          last_run: string | null
          next_run: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["auto_update_settings"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["auto_update_settings"]["Row"]>
      }
      telegram_files: {
        Row: {
          id: number
          message_id: number
          file_name: string | null
          file_size: number | null
          mime_type: string | null
          caption: string | null
          date: string | null
          indexed_at: string | null
          duplicate_of_message_id: number | null
          duplicate_group_key: string | null
          duplicate_rank: number | null
          duplicate_checked_at: string | null
          embedding: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["telegram_files"]["Row"]> & { message_id: number }
        Update: Partial<Database["public"]["Tables"]["telegram_files"]["Row"]>
      }
      telegram_processed_messages: {
        Row: {
          id: string
          message_id: number
          channel: string | null
          book_id: string | null
          telegram_file_id: string | null
          processed_at: string | null
          created_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["telegram_processed_messages"]["Row"]> & { message_id: number }
        Update: Partial<Database["public"]["Tables"]["telegram_processed_messages"]["Row"]>
      }
      telegram_messages_index: {
        Row: {
          id: string
          message_id: number
          channel: string | null
          author: string | null
          title: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["telegram_messages_index"]["Row"]> & { message_id: number }
        Update: Partial<Database["public"]["Tables"]["telegram_messages_index"]["Row"]>
      }
      telegram_sync_status: {
        Row: {
          id: string
          channel_id: number
          last_message_id: number | null
          last_sync_at: string | null
          error_count: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["telegram_sync_status"]["Row"]> & { channel_id: number }
        Update: Partial<Database["public"]["Tables"]["telegram_sync_status"]["Row"]>
      }
      telegram_stats: {
        Row: {
          id: string
          books_in_database: number | null
          books_in_telegram: number | null
          missing_books: number | null
          books_without_files: number | null
          updated_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["telegram_stats"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["telegram_stats"]["Row"]>
      }
      reading_history: {
        Row: {
          id: string
          user_id: string | null
          book_id: string | null
          current_file: string | null
          last_position: number | null
          reading_progress: number | null
          reading_time_minutes: number | null
          last_read_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["reading_history"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["reading_history"]["Row"]>
      }
      user_bookmarks: {
        Row: {
          id: string
          user_id: string | null
          book_id: string | null
          position: number
          chapter: string | null
          note: string | null
          created_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["user_bookmarks"]["Row"]> & { position: number }
        Update: Partial<Database["public"]["Tables"]["user_bookmarks"]["Row"]>
      }
      user_ratings: {
        Row: {
          user_id: string
          book_id: string
          rating: number
          review: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Database["public"]["Tables"]["user_ratings"]["Row"]
        Update: Partial<Database["public"]["Tables"]["user_ratings"]["Row"]>
      }
      user_books: {
        Row: {
          user_id: string
          book_id: string
          is_favorite: boolean | null
          created_at: string | null
        }
        Insert: Database["public"]["Tables"]["user_books"]["Row"]
        Update: Partial<Database["public"]["Tables"]["user_books"]["Row"]>
      }
      user_series: {
        Row: {
          user_id: string
          series_id: string
          is_favorite: boolean | null
          created_at: string | null
        }
        Insert: Database["public"]["Tables"]["user_series"]["Row"]
        Update: Partial<Database["public"]["Tables"]["user_series"]["Row"]>
      }
      user_favorites: {
        Row: {
          id: string
          user_id: string
          book_id: string
          created_at: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["user_favorites"]["Row"]> & { user_id: string; book_id: string }
        Update: Partial<Database["public"]["Tables"]["user_favorites"]["Row"]>
      }
      timer_settings: {
        Row: {
          process_name: string
          enabled: boolean | null
          interval_minutes: number | null
          last_run: string | null
          next_run: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["timer_settings"]["Row"]> & { process_name: string }
        Update: Partial<Database["public"]["Tables"]["timer_settings"]["Row"]>
      }
    }
    Functions: {
      refresh_telegram_file_duplicates: {
        Args: Record<string, never>
        Returns: unknown
      }
    }
  }
}
