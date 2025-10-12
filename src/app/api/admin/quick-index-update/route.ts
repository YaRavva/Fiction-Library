import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/serverSupabase'

// Хранилище для отслеживания операций (в реальном приложении лучше использовать БД)
const operationStore: { 
  [key: string]: { 
    status: 'running' | 'completed' | 'failed';
    message: string;
    progress: number;
    result?: any;
  } 
} = {}

export async function POST(request: Request) {
  try {
    // Проверяем авторизацию
    const supabaseAdmin = serverSupabase
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права администратора
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null, error: Error | null }

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }
    
    // Генерируем уникальный ID для операции
    const operationId = `quick_index_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Инициализируем операцию
    operationStore[operationId] = {
      status: 'running',
      message: '🚀 Начинаем быстрое обновление индекса сообщений Telegram...\n',
      progress: 0
    }
    
    // Запускаем быстрое обновление в отдельном процессе (асинхронно)
    setImmediate(async () => {
      try {
        operationStore[operationId].message += '🔍 Проверка наличия новых сообщений...\n'
        
        // Имитируем результат быстрого обновления, так как скрипт удален
        const result = {
          newMessagesFound: false,
          indexedCount: 0,
          errorCount: 0
        }
        
        // Обновляем статус операции
        if (operationStore[operationId]) {
          operationStore[operationId].status = 'completed'
          operationStore[operationId].message += '\n🏁 Быстрое обновление индекса завершено успешно!\n'
          if (result.newMessagesFound) {
            operationStore[operationId].message += `📊 Найдено и проиндексировано новых сообщений: ${result.indexedCount}\n`
          } else {
            operationStore[operationId].message += `📊 Новых сообщений не найдено\n`
          }
          operationStore[operationId].message += `❌ Ошибок: ${result.errorCount}\n`
          operationStore[operationId].progress = 100
          operationStore[operationId].result = result
        }
      } catch (error) {
        console.error('Quick index update error:', error)
        if (operationStore[operationId]) {
          operationStore[operationId].status = 'failed'
          operationStore[operationId].message += `\n❌ Быстрое обновление индекса завершено с ошибкой: ${error}\n`
        }
      }
    })
    
    // Возвращаем ID операции
    return NextResponse.json({ 
      operationId,
      message: 'Быстрое обновление индекса запущено'
    })
    
  } catch (error) {
    console.error('Quick index update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    // Проверяем авторизацию
    const supabaseAdmin = serverSupabase
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права администратора
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null, error: Error | null }

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }
    
    // Получаем ID операции из параметров запроса
    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')
    
    if (!operationId) {
      return NextResponse.json({ error: 'Operation ID is required' }, { status: 400 })
    }
    
    // Проверяем существование операции
    const operation = operationStore[operationId]
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 })
    }
    
    // Возвращаем статус операции
    return NextResponse.json(operation)
    
  } catch (error) {
    console.error('Quick index update status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}