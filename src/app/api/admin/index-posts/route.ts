import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/serverSupabase'
import { runIndexTelegramPosts } from '@/scripts/index-telegram-posts'

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
    const operationId = `index_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Инициализируем операцию
    operationStore[operationId] = {
      status: 'running',
      message: '🚀 Начинаем индексацию сообщений Telegram...\n',
      progress: 0
    }
    
    // Запускаем индексацию в отдельном процессе (асинхронно)
    setImmediate(async () => {
      try {
        operationStore[operationId].message += '📥 Получение сообщений для индексации...\n'
        
        // Выполняем индексацию
        const result = await runIndexTelegramPosts()
        
        // Обновляем статус операции
        if (operationStore[operationId]) {
          operationStore[operationId].status = 'completed'
          operationStore[operationId].message += '\n🏁 Индексация завершена успешно!\n'
          operationStore[operationId].message += `📊 Статистика:\n`
          operationStore[operationId].message += `  ✅ Проиндексировано: ${result.indexedCount}\n`
          operationStore[operationId].message += `  ❌ Ошибки: ${result.errorCount}\n`
          operationStore[operationId].progress = 100
          operationStore[operationId].result = result
        }
      } catch (error) {
        console.error('Index posts error:', error)
        if (operationStore[operationId]) {
          operationStore[operationId].status = 'failed'
          operationStore[operationId].message += `\n❌ Индексация завершена с ошибкой: ${error}\n`
        }
      }
    })
    
    // Возвращаем ID операции
    return NextResponse.json({ 
      operationId,
      message: 'Индексация сообщений запущена'
    })
    
  } catch (error) {
    console.error('Index posts API error:', error)
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
    console.error('Index posts status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}