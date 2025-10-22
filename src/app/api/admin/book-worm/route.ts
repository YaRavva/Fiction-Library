import { NextRequest, NextResponse } from 'next/server';
import { BookWormService } from '@/lib/telegram/book-worm-service';
import { getSupabaseAdmin } from '@/lib/supabase';
import { spawn } from 'child_process';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    // Получаем клиент Supabase с service role key
    const supabaseAdmin = getSupabaseAdmin();
    
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error: Supabase admin client not available' },
        { status: 500 }
      );
    }

    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Получаем токен из заголовка
    const token = authHeader.replace('Bearer ', '');
    
    // Проверяем пользователя через Supabase
    try {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError) {
        console.error('Supabase auth error:', authError);
        // Если ошибка авторизации, возвращаем 401
        if (authError.message.includes('Invalid JWT') || authError.message.includes('jwt')) {
          return NextResponse.json(
            { error: 'Unauthorized: Invalid token' },
            { status: 401 }
          );
        }
        // Для других ошибок возвращаем 500
        return NextResponse.json(
          { error: 'Authentication service error: ' + authError.message },
          { status: 500 }
        );
      }
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized: User not found' },
          { status: 401 }
        );
      }

      // Проверяем, что пользователь - админ
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || (profile as { role?: string })?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: Admin access required' },
          { status: 403 }
        );
      }
    } catch (authException: unknown) {
      console.error('Authentication exception:', authException);
      const errorMessage = authException instanceof Error ? authException.message : 'Unknown auth error';
      return NextResponse.json(
        { error: 'Authentication failed: ' + errorMessage },
        { status: 500 }
      );
    }

    // Получаем параметры из body
    const body = await request.json();
    const mode = body.mode;

    // Валидация режима
    if (!mode || !['full', 'update', 'index'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode. Use "full", "update", or "index"' }, { status: 400 });
    }

    // Для режима индексации выполняем индексацию сообщений непосредственно в этом запросе
    if (mode === 'index') {
      try {
        // Создаем экземпляр сервиса
        const bookWorm = await BookWormService.getInstance();
        
        // Выполняем индексацию всех сообщений
        const result = await bookWorm.run('full');
        
        return NextResponse.json({ 
          success: true, 
          message: 'Telegram messages indexing completed',
          mode,
          result
        });
      } catch (indexError: unknown) {
        console.error('Telegram messages indexing error:', indexError);
        const errorMessage = indexError instanceof Error ? indexError.message : 'Unknown indexing error occurred';
        return NextResponse.json({ error: 'Indexing error: ' + errorMessage }, { status: 500 });
      }
    }

    // Для режима "update" выполняем синхронизацию непосредственно в этом запросе
    // Это работает как на локальном сервере, так и на Vercel
    if (mode === 'update') {
      try {
        // Создаем экземпляр сервиса
        const bookWorm = await BookWormService.getInstance();
        
        // Выполняем синхронизацию и дожидаемся результата
        const result = await bookWorm.runUpdateSync();
        
        // Форматируем сообщение красиво с иконками для вывода
        const formattedMessage = `🔄 Книжный Червь - синхронизация обновления завершена:

📊 Обработано: ${result.processed}
➕ Добавлено книг: ${result.added}
🔄 Обновлено книг: ${result.updated}
🔗 Привязано файлов: ${result.matched}
🆔 Начато с сообщения ID: ${result.lastProcessedMessageId || 'начала'}

💬 ${result.message}`;

        console.log(formattedMessage);

        return NextResponse.json({
          success: true,
          message: 'Book Worm update sync completed',
          mode,
          status: 'completed',
          result,
          formattedMessage // Включаем отформатированное сообщение в ответ
        });
        
      } catch (syncError: unknown) {
        const errorMessage = syncError instanceof Error ? syncError.message : 'Неизвестная ошибка синхронизации';
        const errorFormattedMessage = `❌ Ошибка синхронизации Книжного Червя:
        
📝 Ошибка: ${errorMessage}
📅 Время: ${new Date().toLocaleString('ru-RU')}`;

        console.error(errorFormattedMessage);
        
        return NextResponse.json({ 
          error: 'Sync error: ' + errorMessage,
          formattedErrorMessage: errorFormattedMessage // Включаем отформатированное сообщение об ошибке в ответ
        }, { status: 500 });
      }
    } else if (mode === 'full') {
      // Для режима "full" предлагаем использовать новый endpoint
      return NextResponse.json({ 
        error: 'For full sync, please use the dedicated endpoint at /api/admin/book-worm/full-sync',
        suggestion: 'POST to /api/admin/book-worm/full-sync with the same authorization header'
      }, { status: 400 });
    } else {
      // Неизвестный режим
      return NextResponse.json({ error: 'Invalid mode. Use "full", "update", or "index"' }, { status: 400 });
    }
    
  } catch (error: unknown) {
    console.error('Book Worm API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: 'Internal server error: ' + errorMessage }, { status: 500 });
  }
}