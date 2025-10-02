import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCovers() {
  console.log('🔍 Проверка обложек в базе данных...\n')

  // Получаем все книги
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('id, title, author, cover_url')
    .order('created_at', { ascending: false })
    .limit(10)

  if (booksError) {
    console.error('❌ Ошибка получения книг:', booksError)
    return
  }

  console.log(`📚 Найдено книг: ${books?.length || 0}\n`)

  if (!books || books.length === 0) {
    console.log('⚠️  В базе данных нет книг')
    return
  }

  let withCovers = 0
  let withoutCovers = 0

  books.forEach((book, index) => {
    console.log(`${index + 1}. "${book.title}" - ${book.author}`)
    if (book.cover_url) {
      console.log(`   ✅ Обложка: ${book.cover_url}`)
      withCovers++
    } else {
      console.log(`   ❌ Обложка отсутствует`)
      withoutCovers++
    }
    console.log()
  })

  console.log('📊 Статистика:')
  console.log(`   С обложками: ${withCovers}`)
  console.log(`   Без обложек: ${withoutCovers}`)
  console.log(`   Всего: ${books.length}`)

  // Проверяем файлы в Storage
  console.log('\n📦 Проверка файлов в Storage bucket "covers"...')
  const { data: files, error: filesError } = await supabase
    .storage
    .from('covers')
    .list()

  if (filesError) {
    console.error('❌ Ошибка получения файлов:', filesError)
    return
  }

  console.log(`   Файлов в bucket: ${files?.length || 0}`)
  if (files && files.length > 0) {
    console.log('\n   Последние 5 файлов:')
    files.slice(0, 5).forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.name}`)
    })
  }
}

checkCovers().catch(console.error)

