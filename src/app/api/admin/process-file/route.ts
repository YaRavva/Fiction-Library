import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '@/lib/telegram/sync';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/process-file
 * Обрабатывает один файл по ID сообщения
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

    // Получаем ID сообщения из тела запроса
    let messageId;
    try {
      const body = await request.json();
      messageId = body.messageId;
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (!messageId) {
      return NextResponse.json(
        { error: 'Missing messageId' },
        { status: 400 }
      );
    }

    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Обрабатываем файл
    const result = await syncService.processSingleFileById(messageId);
    
    const success = result.success !== false;
    
    // Формируем отчет об операции
    let report = `📚 Результаты обработки файла\n\n`;
    report += `Статус: ${success ? 'Успешно' : 'Ошибка'}\n`;
    report += `Файл: ${result.filename || 'Без имени'} (ID: ${result.messageId})\n\n`;
    
    if (!success && result.error) {
      report += `❌ Ошибка: ${result.error}\n`;
    }
    
    if (result.bookTitle && result.bookAuthor) {
      report += `📘 Книга: ${result.bookAuthor} - ${result.bookTitle}\n`;
    }
    
    if (result.fileSize) {
      report += `📏 Размер файла: ${result.fileSize} байт\n`;
    }
    
    if (result.fileUrl) {
      report += `🔗 URL файла: ${result.fileUrl}\n`;
    }

    return NextResponse.json({
      message: success ? 'Файл успешно обработан' : 'Ошибка обработки файла',
      result,
      report
    });
  } catch (error) {
    console.error('Ошибка обработки файла:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}