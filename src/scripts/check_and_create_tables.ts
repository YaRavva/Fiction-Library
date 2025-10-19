import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

dotenv.config();

async function checkAndCreateTables() {
  try {
    console.log('🔍 Checking if telegram_processed_messages table exists...');
    
    // Try to query the table to see if it exists
    const { data, error } = await serverSupabase
      .from('telegram_processed_messages')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') { // Undefined table error
        console.log('❌ Table telegram_processed_messages does not exist. Creating it...');
        
        // Create the table
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS telegram_processed_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id TEXT NOT NULL,
            channel TEXT NOT NULL,
            book_id UUID REFERENCES books(id) ON DELETE SET NULL,
            processed_at TIMESTAMPTZ DEFAULT now(),
            created_at TIMESTAMPTZ DEFAULT now()
          );
          
          CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_message_id ON telegram_processed_messages(message_id);
          CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_channel ON telegram_processed_messages(channel);
          CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_book_id ON telegram_processed_messages(book_id);
          CREATE INDEX IF NOT EXISTS idx_telegram_processed_messages_processed_at ON telegram_processed_messages(processed_at);
          
          ALTER TABLE books 
          ADD COLUMN IF NOT EXISTS metadata_processed BOOLEAN DEFAULT FALSE;
          
          CREATE INDEX IF NOT EXISTS idx_books_metadata_processed ON books(metadata_processed);
        `;
        
        // We can't execute raw SQL with Supabase client, so we'll need to use the Supabase CLI or dashboard
        console.log('⚠️ Please run the following SQL in your Supabase SQL editor:');
        console.log(createTableQuery);
      } else {
        console.error('❌ Error checking table:', error);
      }
    } else {
      console.log('✅ Table telegram_processed_messages exists');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAndCreateTables();