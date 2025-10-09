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
        const bookWorm = new BookWormService();
        
        // Выполняем индексацию всех сообщений
        const result = await bookWorm.indexAllMessages();
        
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
        const bookWorm = new BookWormService();
        
        // Выполняем синхронизацию в режиме обновления
        const result = await bookWorm.runUpdateSync();
        
        // Формируем подробный отчет
        const reportLines = [
          '🐋 Результаты работы Книжного Червя в режиме ОБНОВЛЕНИЯ:',
          '=====================================================',
          '',
          '📚 Метаданные:',
          `   ✅ Обработано: ${result.metadata.processed}`,
          `   ➕ Добавлено: ${result.metadata.added}`,
          `   🔄 Обновлено: ${result.metadata.updated}`,
          `   ⚠️  Пропущено: ${result.metadata.skipped}`,
          `   ❌ Ошибок: ${result.metadata.errors}`,
          '',
          '📁 Файлы:',
          `   ✅ Обработано: ${result.files.processed}`,
          `   🔗 Привязано: ${result.files.linked}`,
          `   ⚠️  Пропущено: ${result.files.skipped}`,
          `   ❌ Ошибок: ${result.files.errors}`,
          '',
          '📊 Сводка:',
          `   Всего обработано элементов: ${result.metadata.processed + result.files.processed}`,
          `   Успешных операций: ${result.metadata.added + result.metadata.updated + result.files.linked}`,
          `   Ошибок: ${result.metadata.errors + result.files.errors}`
        ];
        
        return NextResponse.json({ 
          success: true, 
          message: 'Book Worm update sync completed',
          mode,
          result,
          report: reportLines.join('\n')
        });
      } catch (syncError: unknown) {
        console.error('Book Worm sync error:', syncError);
        const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown sync error occurred';
        return NextResponse.json({ error: 'Sync error: ' + errorMessage }, { status: 500 });
      }
    } else {
      // Для полной синхронизации используем подход с запуском отдельного процесса
      // только в режиме разработки
      if (process.env.NODE_ENV !== 'development') {
        // В production среде (включая Vercel) полная синхронизация недоступна из-за ограничений среды
        return NextResponse.json({ 
          error: 'Full sync is only available in development mode due to environment limitations. Please run it locally.' 
        }, { status: 400 });
      }
      
      // В режиме разработки пытаемся запустить отдельный процесс
      try {
        // Используем прямой путь к tsx через node_modules
        const scriptPath = join(process.cwd(), 'src', 'scripts', 'run-book-worm.ts');
        // Пробуем запустить через npx tsx (как указано в ваших предпочтениях)
        const child = spawn('npx', ['tsx', scriptPath, mode], {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        return NextResponse.json({ 
          success: true, 
          message: `Book Worm started in ${mode} mode`,
          mode,
          pid: child.pid
        });
      } catch (spawnError: unknown) {
        console.error('Book Worm spawn error:', spawnError);
        const errorMessage = spawnError instanceof Error ? spawnError.message : 'Unknown spawn error occurred';
        return NextResponse.json({ error: 'Failed to start process: ' + errorMessage }, { status: 500 });
      }
    }
    
  } catch (error: unknown) {
    console.error('Book Worm API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: 'Internal server error: ' + errorMessage }, { status: 500 });
  }
}