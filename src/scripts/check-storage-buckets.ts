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

async function checkStorageBuckets() {
  console.log('Проверка buckets в Supabase Storage...');
  
  try {
    // Получаем список всех buckets
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    
    if (error) {
      console.error('Ошибка при получении списка buckets:', error);
      return;
    }
    
    console.log(`Найдено ${buckets.length} buckets:`);
    buckets.forEach((bucket, index) => {
      console.log(`${index + 1}. ${bucket.name} (id: ${bucket.id})`);
      console.log(`   Public: ${bucket.public}`);
      console.log(`   Created at: ${bucket.created_at}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Ошибка при проверке buckets:', error);
  }
}

checkStorageBuckets().catch(console.error);