import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '@/lib/telegram/sync';
import { DownloadWorker } from '@/lib/telegram/download-worker';
import { TelegramService } from '@/lib/telegram/client';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/download-files-limit
 * Добавляет задачи загрузки файлов в очередь из Telegram с указанным лимитом
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

    console.log(`🚀 Добавление задач загрузки файлов в очередь с лимитом: ${limit}`);

    // Получаем экземпляр Telegram клиента напрямую
    const telegramClient = await TelegramService.getInstance();
    
    // Получаем канал с файлами
    const channel = await telegramClient.getFilesChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    // Получаем сообщения с пагинацией
    console.log(`📥 Получаем сообщения (лимит: ${limit})...`);
    const messages = await Promise.race([
      telegramClient.getMessages(channelId, limit) as unknown as any[],
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting messages')), 60000))
    ]) as unknown as any[];
    console.log(`✅ Получено ${messages.length} сообщений для добавления в очередь\n`);

    // Получаем экземпляр воркера для добавления задач в очередь
    const worker = await DownloadWorker.getInstance();
    
    // Добавляем задачи в очередь
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const msg of messages) {
      const anyMsg = msg as unknown as {[key: string]: unknown};
      
      // Проверяем, есть ли в сообщении медиа (файл)
      if (!(anyMsg.media as unknown)) {
        console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит медиа, пропускаем`);
        skippedCount++;
        continue;
      }
      
      try {
        // Добавляем задачу в очередь
        await worker.addTask(String(anyMsg.id), channelId, 0);
        addedCount++;
        console.log(`  ✅ Задача добавлена в очередь для сообщения ${anyMsg.id}`);
      } catch (msgError) {
        console.error(`  ❌ Ошибка добавления задачи для сообщения ${anyMsg.id}:`, msgError);
        skippedCount++;
      }
    }
    
    console.log(`✅ Добавление задач в очередь завершено: ${addedCount} добавлено, ${skippedCount} пропущено`);
    
    // Формируем отчет об операции в простом текстовом формате с иконками
    let report = `📚 Результаты добавления задач в очередь\n\n`;
    report += `📊 Статистика:\n`;
    report += `- Сообщений найдено: ${messages.length}\n`;
    report += `- Задач добавлено в очередь: ${addedCount}\n`;
    report += `- Пропущено: ${skippedCount}\n\n`;
    
    if (addedCount > 0) {
      report += `✅ Добавленные задачи:\n`;
      // Добавляем информацию о добавленных задачах
      let taskIndex = 1;
      for (const msg of messages) {
        const anyMsg = msg as unknown as {[key: string]: unknown};
        if (anyMsg.media as unknown) {
          // Извлекаем имя файла если возможно
          let filename = `book_${anyMsg.id}.fb2`;
          if (anyMsg.document && (anyMsg.document as {[key: string]: unknown}).attributes) {
            const attributes = (anyMsg.document as {[key: string]: unknown}).attributes as unknown[];
            const attrFileName = attributes.find((attr: unknown) => {
              const attrObj = attr as {[key: string]: unknown};
              return attrObj.className === 'DocumentAttributeFilename';
            }) as {[key: string]: unknown} | undefined;
            if (attrFileName && attrFileName.fileName) {
              filename = attrFileName.fileName as string;
            }
          }
          report += `${taskIndex}. ${filename} (ID: ${anyMsg.id})\n`;
          taskIndex++;
        }
      }
      report += `\n📥 Задачи добавлены в очередь для обработки воркером.\n`;
      report += `Для запуска обработки задач:\n`;
      report += `- Используйте кнопку "Запустить воркер" в админ панели\n`;
      report += `- Или выполните команду: npm run start-download-worker\n\n`;
    }
    
    if (skippedCount > 0) {
      report += `⚠️ Пропущенные сообщения:\n`;
      let skippedIndex = 1;
      for (const msg of messages) {
        const anyMsg = msg as unknown as {[key: string]: unknown};
        if (!(anyMsg.media as unknown)) {
          report += `${skippedIndex}. Сообщение ${anyMsg.id} (без медиа)\n`;
          skippedIndex++;
        }
      }
      report += `\n`;
    }
    
    report += `📊 Для отслеживания прогресса:\n`;
    report += `- Админ панель: раздел "Очередь загрузки"\n`;
    report += `- Команда: npm run check-download-queue\n`;
    
    return NextResponse.json({
      message: 'Задачи добавлены в очередь',
      results: {
        added: addedCount,
        skipped: skippedCount,
        total: messages.length,
        errors: [],
        actions: [
          `Сообщений найдено: ${messages.length}`,
          `Задач добавлено в очередь: ${addedCount}`,
          `Пропущено: ${skippedCount}`
        ]
      },
      report
    });
  } catch (error) {
    console.error('Ошибка добавления задач в очередь:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}