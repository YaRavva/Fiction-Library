// Test the fixed API endpoint
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Инициализация Supabase клиента
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function testFixedApi() {
  console.log('Testing fixed API...');
  
  try {
    // Пытаемся получить последние сохраненные статистические данные
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('telegram_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (statsError) {
      console.error('Error fetching stats:', statsError);
      return;
    }

    console.log('Database stats:', stats);

    // Возвращаем сохраненные статистические данные, преобразовав их в ожидаемый формат
    const responseData = {
      booksInDatabase: stats.books_in_database || 0,
      booksInTelegram: stats.books_in_telegram || 0,
      missingBooks: stats.missing_books || 0,
      booksWithoutFiles: stats.books_without_files || 0,
    };
    
    console.log('Fixed API response data:', responseData);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testFixedApi().catch(console.error);