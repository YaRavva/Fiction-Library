import { createClient } from '@supabase/supabase-js'

// Откладываем проверку переменных окружения до момента создания клиента
let supabaseUrl: string | undefined;
let serviceRoleKey: string | undefined;

function initializeEnv() {
  supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export const serverSupabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    // Инициализируем переменные окружения при первом обращении
    if (!supabaseUrl || !serviceRoleKey) {
      initializeEnv();
    }
    
    // Проверяем переменные окружения
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
    }
    
    // Создаем клиент при первом обращении
    if (!(target as any)._client) {
      (target as any)._client = createClient(supabaseUrl, serviceRoleKey);
    }
    
    // Перенаправляем вызовы к реальному клиенту
    return (target as any)._client[prop as keyof ReturnType<typeof createClient>];
  }
});