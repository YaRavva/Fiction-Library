import { NextResponse } from 'next/server';
import { syncBooks } from '../../../../scripts/sync-books';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    console.log('📥 Получен запрос на синхронизацию книг');
    
    // Получаем параметры из тела запроса
    const { limit = 10 } = await request.json();
    
    console.log(`🚀 Запуск синхронизации книг (лимит: ${limit})`);
    
    // Выполняем синхронизацию синхронно и ждем результат
    const result = await syncBooks(limit);
    
    console.log('✅ Синхронизация книг завершена:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Ошибка синхронизации книг:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Неизвестная ошибка синхронизации' 
      }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log('📥 Получен GET запрос на синхронизацию книг');
    
    // Выполняем синхронизацию с лимитом по умолчанию
    const result = await syncBooks(10);
    
    console.log('✅ Синхронизация книг завершена');
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Ошибка синхронизации книг:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Неизвестная ошибка синхронизации' 
      }, 
      { status: 500 }
    );
  }
}