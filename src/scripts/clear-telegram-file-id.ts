import { getSupabaseAdmin } from '../lib/supabase';

async function clearTelegramFileIds() {
  const admin = getSupabaseAdmin();
  
  if (!admin) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    process.exit(1);
  }

  try {
    console.log('🔍 Получаем количество записей с заполненным telegram_file_id...');
    
    const { count, error: countError } = await admin
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('telegram_file_id', 'is', null);
      
    if (countError) {
      console.error('❌ Ошибка при подсчете записей:', countError.message);
      process.exit(1);
    }
    
    console.log(`📊 Найдено записей с заполненным telegram_file_id: ${count}`);
    
    if (count === 0) {
      console.log('✅ Нет записей для очистки');
      process.exit(0);
    }
    
    console.log('🔄 Очищаем поле telegram_file_id во всех записях...');
    
    // Type assertion to fix typing issues with Supabase client
    const typedAdmin = admin as unknown as {
      from: (table: string) => {
        update: (data: Record<string, unknown>) => {
          not: (column: string, operator: string, value: unknown) => {
            select: () => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
    };
    
    const { data, error } = await typedAdmin
      .from('books')
      .update({ telegram_file_id: null })
      .not('telegram_file_id', 'is', null)
      .select();
      
    if (error) {
      console.error('❌ Ошибка при очистке поля:', (error as Error).message);
      process.exit(1);
    }
    
    console.log(`✅ Успешно очищено ${data.length} записей`);
    
  } catch (err) {
    console.error('❌ Неожиданная ошибка:', err);
    process.exit(1);
  }
}

clearTelegramFileIds();