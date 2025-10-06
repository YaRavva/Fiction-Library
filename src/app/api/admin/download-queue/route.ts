import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DownloadQueue } from '@/lib/telegram/queue';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/download-queue
 * Добавляет файл в очередь загрузки
 * 
 * Body:
 * - message_id: string - ID сообщения в Telegram
 * - channel_id: string - ID канала
 * - file_id: string (опционально) - ID файла
 * - book_id: string (опционально) - ID книги в базе
 * - priority: number (опционально) - приоритет загрузки
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем роль админа
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

    // Получаем параметры из body
    const body = await request.json();
    const { message_id, channel_id, file_id, book_id, priority } = body;

    if (!message_id || !channel_id) {
      return NextResponse.json(
        { error: 'message_id and channel_id are required' },
        { status: 400 }
      );
    }

    // Добавляем задачу в очередь
    const queue = new DownloadQueue();
    const task = await queue.addTask({
      message_id,
      channel_id,
      file_id,
      book_id,
      priority,
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Не удалось добавить задачу в очередь' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Задача добавлена в очередь',
      task,
    });
  } catch (error) {
    console.error('Ошибка добавления задачи в очередь:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/download-queue
 * Получает список задач в очереди
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Получаем параметры из query
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    // Получаем задачи из очереди
    let query = supabaseAdmin
      .from('telegram_download_queue')
      .select('*')
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      throw tasksError;
    }

    // Получаем статистику
    const queue = new DownloadQueue();
    const stats = await queue.getQueueStats();

    return NextResponse.json({
      tasks: tasks || [],
      stats,
    });
  } catch (error) {
    console.error('Ошибка получения очереди загрузки:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/download-queue/:id
 * Удаляет задачу из очереди
 */
export async function DELETE(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем роль админа
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

    // Получаем ID задачи из query
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Требуется ID задачи' },
        { status: 400 }
      );
    }

    // Удаляем задачу
    const { error: deleteError } = await supabaseAdmin
      .from('telegram_download_queue')
      .delete()
      .eq('id', taskId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      message: 'Задача успешно удалена',
    });
  } catch (error) {
    console.error('Ошибка удаления задачи:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

