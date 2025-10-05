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
 * POST /api/admin/download-files-limit
 * Запускает загрузку файлов из Telegram с указанным лимитом
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

    // Получаем лимит из тела запроса
    const body = await request.json();
    const limit = body.limit || 10; // По умолчанию 10 файлов

    console.log(`🚀 Запуск загрузки файлов с лимитом: ${limit}`);

    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Скачиваем и обрабатываем файлы напрямую с указанным лимитом
    const results = await syncService.downloadAndProcessFilesDirectly(limit);
    
    const successCount = results.filter((result: { success?: boolean; skipped?: boolean }) => result.success !== false && !result.skipped).length;
    const skippedCount = results.filter((result: { skipped?: boolean }) => result.skipped).length;
    const failedCount = results.length - successCount - skippedCount;
    
    console.log(`✅ Загрузка завершена: ${successCount} успешно, ${skippedCount} пропущено, ${failedCount} с ошибками`);
    
    // Формируем отчет об операции
    let report = `Загрузка файлов завершена:\n`;
    report += `Обработано файлов: ${results.length}\n`;
    report += `Успешно: ${successCount}\n`;
    report += `Пропущено: ${skippedCount}\n`;
    report += `С ошибками: ${failedCount}\n\n`;
    
    if (results.length > 0) {
      report += `Детали обработки:\n`;
      results.forEach((result: any, index: number) => {
        let status = '✅';
        if (result.skipped) {
          status = 'ℹ️';
        } else if (!result.success) {
          status = '❌';
        }
        
        report += `${index + 1}. ${status} ${result.filename || 'Без имени'} (ID: ${result.messageId})\n`;
        if (result.skipped) {
          const reason = result.reason || 'Неизвестная причина';
          const reasonText = reason === 'book_not_found' ? 'Книга не найдена' : 
                            reason === 'already_processed' ? 'Уже обработан' : 
                            reason === 'book_not_imported' ? 'Книга не импортирована' : reason;
          report += `   Причина: ${reasonText}\n`;
        } else if (!result.success && result.error) {
          report += `   Ошибка: ${result.error}\n`;
        }
      });
    }
    
    // Не завершаем процесс принудительно, так как это может выключить сервер разработки
    // Вместо этого просто возвращаем результат
    
    return NextResponse.json({
      message: 'File download completed',
      results: {
        success: successCount,
        skipped: skippedCount,
        failed: failedCount,
        errors: [],
        actions: [
          `Обработано файлов: ${results.length}`,
          `Успешно: ${successCount}`,
          `Пропущено: ${skippedCount}`,
          `С ошибками: ${failedCount}`
        ]
      },
      report
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}