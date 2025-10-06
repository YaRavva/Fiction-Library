import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DownloadWorker } from '@/lib/telegram/download-worker';
import { DownloadQueue } from '@/lib/telegram/queue';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * GET /api/admin/queue
 * Получает статус очереди и список задач
 */
export async function GET(request: NextRequest) {
  try {
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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем, что пользователь - админ
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Получаем экземпляр очереди
    const queue = new DownloadQueue();
    
    // Получаем статистику очереди
    const { data: allTasks, error: allTasksError } = await supabaseAdmin
      .from('telegram_download_queue')
      .select('status');

    if (allTasksError) {
      return NextResponse.json(
        { error: 'Error getting queue stats' },
        { status: 500 }
      );
    }

    // Группируем задачи по статусам
    const statusStats: Record<string, number> = {};
    if (allTasks) {
      allTasks.forEach((task: any) => {
        statusStats[task.status] = (statusStats[task.status] || 0) + 1;
      });
    }

    // Получаем активные задачи
    const activeTasks = await queue.getActiveTasks(20);

    return NextResponse.json({
      stats: statusStats,
      activeTasks: activeTasks
    });
  } catch (error) {
    console.error('Queue status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/queue
 * Управляет воркером очереди (запуск, остановка, статус)
 */
export async function POST(request: NextRequest) {
  try {
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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем, что пользователь - админ
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Получаем действие из тела запроса
    const body = await request.json();
    const { action, interval } = body;

    // Отключаем запуск воркера
    switch (action) {
      case 'start':
        return NextResponse.json({ 
          message: 'Воркер загрузки файлов отключен. Используется старый метод с file-service.ts' 
        }, { status: 400 });

      case 'stop':
        return NextResponse.json({ 
          message: 'Воркер загрузки файлов уже отключен' 
        });

      case 'status':
        // Возвращаем статус воркера - всегда отключен
        return NextResponse.json({ 
          message: 'Воркер загрузки файлов отключен', 
          running: false 
        });

      default:
        return NextResponse.json(
          { error: 'Недопустимое действие. Используйте: start, stop, status' },
          { status: 400 }
        );
    }
    
    /*
    // Получаем экземпляр воркера
    const worker = await DownloadWorker.getInstance();

    switch (action) {
      case 'start':
        await worker.start(interval || 30000);
        return NextResponse.json({ message: 'Воркер запущен' });

      case 'stop':
        await worker.stop();
        return NextResponse.json({ message: 'Воркер остановлен' });

      case 'status':
        // Возвращаем статус воркера
        return NextResponse.json({ 
          message: 'Статус воркера', 
          running: (worker as any).isRunning || false 
        });

      default:
        return NextResponse.json(
          { error: 'Недопустимое действие. Используйте: start, stop, status' },
          { status: 400 }
        );
    }
    */
  } catch (error) {
    console.error('Ошибка управления очередью:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}