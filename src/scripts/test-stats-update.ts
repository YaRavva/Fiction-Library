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

async function testStatsUpdate() {
  console.log('Testing stats update...');
  
  try {
    // Создаем тестовые данные
    const testData = {
      books_in_database: 100,
      books_in_telegram: 200,
      missing_books: 50,
      books_without_files: 30,
      updated_at: new Date().toISOString()
    };

    console.log('Test data:', testData);

    // Пытаемся сохранить данные в таблицу
    const { error: upsertError } = await supabaseAdmin
      .from('telegram_stats')
      .upsert(testData, { onConflict: 'id' });

    if (upsertError) {
      console.error('Error saving stats:', upsertError);
      return;
    }

    console.log('✅ Test data saved successfully');
    
    // Проверяем, что данные сохранились
    const { data, error } = await supabaseAdmin
      .from('telegram_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching saved data:', error);
      return;
    }

    console.log('Saved data:', data);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testStatsUpdate().catch(console.error);