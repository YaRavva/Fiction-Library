import { NextResponse } from 'next/server';
// Отключаем импорт DownloadWorker, так как воркеры отключены
// import { DownloadWorker } from '@/lib/telegram/download-worker';

// Глобальная переменная для хранения экземпляра воркера
// Отключаем воркер
// let workerInstance: DownloadWorker | null = null;
const workerInstance: null = null;

/**
 * POST /api/admin/worker
 * Управление воркером загрузки файлов
 * 
 * Тело запроса:
 * {
 *   "action": "start" | "stop" | "status",
 *   "interval": number (опционально, для start)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, interval } = body;

    switch (action) {
      case 'start':
        // Отключаем запуск воркера
        return NextResponse.json({
          success: false,
          message: 'Воркер загрузки файлов отключен. Используется старый метод с file-service.ts'
        }, { status: 400 });

        /*
        // Если воркер еще не создан, создаем его
        if (!workerInstance) {
          workerInstance = await DownloadWorker.getInstance();
        }

        // Запускаем воркер с указанным интервалом или значением по умолчанию (30 секунд)
        const intervalMs = interval || 30000;
        await workerInstance.start(intervalMs);
        
        return NextResponse.json({
          success: true,
          message: `Worker запущен с интервалом ${intervalMs}ms`
        });
        */

      case 'stop':
        // Отключаем остановку воркера
        return NextResponse.json({
          success: true,
          message: 'Воркер загрузки файлов уже отключен'
        });

        /*
        if (workerInstance) {
          await workerInstance.stop();
          return NextResponse.json({
            success: true,
            message: 'Worker остановлен'
          });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Worker не запущен'
          });
        }
        */

      case 'status':
        // Возвращаем статус воркера - всегда отключен
        return NextResponse.json({
          success: true,
          workerRunning: false,
          message: 'Воркер загрузки файлов отключен. Используется старый метод с file-service.ts'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Неподдерживаемое действие. Поддерживаемые действия: start, stop, status'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Ошибка управления worker\'ом:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 });
  }
}