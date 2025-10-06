import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { taskManager } from '@/lib/task-manager';
import { BackgroundDownloadHandler } from '@/lib/background-download';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/download-files
 * Запускает асинхронную загрузку отсутствующих файлов книг с отображением прогресса
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

    // Получаем лимит из тела запроса или используем значение по умолчанию
    let limit = 50; // Значение по умолчанию
    try {
      const body = await request.json();
      limit = body.limit || limit;
    } catch (e) {
      // Если не удалось получить тело запроса, используем значение по умолчанию
    }

    // Создаем уникальный ID для этой операции
    const operationId = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Создаем задачу
    taskManager.createTask(operationId);
    
    // Запускаем фоновую загрузку в отдельном потоке
    setImmediate(() => {
      BackgroundDownloadHandler.startDownload(operationId, limit);
    });
    
    // Отправляем немедленный ответ с ID операции
    return NextResponse.json({
      message: 'Операция загрузки файлов запущена',
      operationId,
      status: 'started'
    });
  } catch (error) {
    console.error('Ошибка запуска загрузки файлов:', error);
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
 * GET /api/admin/download-files?operationId=...
 * Получает статус и прогресс операции загрузки файлов
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

    // Получаем ID операции из параметров запроса
    const operationId = request.nextUrl.searchParams.get('operationId');
    
    if (!operationId) {
      return NextResponse.json(
        { error: 'Missing operationId parameter' },
        { status: 400 }
      );
    }

    // Получаем статус задачи
    const taskStatus = taskManager.getTaskStatus(operationId);
    
    if (!taskStatus) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      );
    }

    // Если операция завершена, формируем отчет
    if (taskStatus.status === 'completed' && taskStatus.result) {
      const result = taskStatus.result;
      const successCount = result.successCount || 0;
      const failedCount = result.failedCount || 0;
      const results = result.results || [];
      
      // Формируем компактный отчет об операции
      let report = `🚀 Результаты загрузки файлов\n`;
      report += `📊 Статистика: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${results.length}\n\n`;
      
      if (results.length > 0) {
        report += `📋 Детали обработки:\n`;
        results.forEach((result: any, index: number) => {
          const status = result.success !== false ? '✅' : '❌';
          const filename = result.filename || 'Без имени';
          report += ` ${index + 1}. ${status} ${filename} `;
          
          // Добавляем информацию о книге, если она есть
          if (result.bookTitle && result.bookAuthor) {
            report += `(${result.bookAuthor} - ${result.bookTitle}) `;
          }
          
          // Добавляем размер файла, если он есть
          if (result.fileSize) {
            report += `(${Math.round(result.fileSize / 1024)} KB) `;
          }
          
          // Добавляем ошибку, если она есть
          if (result.success === false && result.error) {
            report += `[Ошибка: ${result.error.substring(0, 30)}...] `;
          }
        });
        report += '\n';
      }

      return NextResponse.json({
        message: 'Загрузка файлов завершена',
        operationId,
        status: taskStatus.status,
        progress: taskStatus.progress,
        results: {
          success: successCount,
          failed: failedCount,
          errors: [],
          actions: [
            `Обработано файлов: ${results.length}`,
            `Успешно: ${successCount}`,
            `С ошибками: ${failedCount}`,
            ...(results.map((result: any, index: number) => {
              const status = result.success !== false ? '✅' : '❌';
              const filename = result.filename || 'Без имени';
              if (result.skipped) {
                return `⚠️ ${filename} (пропущен)`;
              }
              return `${status} ${filename}`;
            }))
          ]
        },
        report
      });
    }

    // Если операция еще не завершена, возвращаем текущий статус
    // Формируем компактный отчет об операции
    let report = `🚀 Результаты загрузки файлов\n\n`;
    
    // Разбираем сообщение для отображения
    const messageLines = taskStatus.message ? taskStatus.message.split('\n') : []
    if (messageLines.length > 0) {
      // Первая строка - обработанные файлы
      if (messageLines[0]) {
        report += `Обработанные файлы: ${messageLines[0]}\n`;
      }
      
      // Остальные строки - текущий статус
      for (let i = 1; i < messageLines.length; i++) {
        if (messageLines[i]) {
          report += `${messageLines[i]}\n`;
        }
      }
    } else {
      report += `${taskStatus.message || ''}\n`;
    }
    
    report += `\n📊 Статус: ${taskStatus.status}  📈 Прогресс: ${taskStatus.progress}%\n`;

    return NextResponse.json({
      operationId,
      status: taskStatus.status,
      progress: taskStatus.progress,
      message: taskStatus.message,
      result: taskStatus.result,
      createdAt: taskStatus.createdAt,
      updatedAt: taskStatus.updatedAt,
      report
    });
  } catch (error) {
    console.error('Ошибка получения статуса операции:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}