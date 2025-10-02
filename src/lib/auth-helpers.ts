import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Проверяет сессию и очищает её, если она недействительна
 * Возвращает true, если сессия валидна, false - если нет
 */
export async function checkAndRefreshSession(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Если ошибка или нет сессии - очищаем и возвращаем false
    if (error || !session) {
      console.log('No valid session found, clearing...');
      await supabase.auth.signOut();
      return false;
    }

    // Проверяем, не истек ли токен
    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      console.log('Session expired, refreshing...');
      
      // Пытаемся обновить сессию
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !newSession) {
        console.log('Failed to refresh session, clearing...');
        await supabase.auth.signOut();
        return false;
      }
      
      console.log('Session refreshed successfully');
      return true;
    }

    return true;
  } catch (error) {
    console.error('Error checking session:', error);
    // В случае любой ошибки - очищаем сессию
    await supabase.auth.signOut();
    return false;
  }
}

/**
 * Получает валидную сессию или null
 */
export async function getValidSession(supabase: SupabaseClient) {
  const isValid = await checkAndRefreshSession(supabase);
  
  if (!isValid) {
    return null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

