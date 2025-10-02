import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function testStorageUrl() {
  console.log('🔍 Проверка URL обложек в Storage...\n')

  // Получаем список файлов
  const { data: files, error } = await supabase
    .storage
    .from('covers')
    .list('', { limit: 5 })

  if (error) {
    console.error('❌ Ошибка:', error)
    return
  }

  console.log(`📦 Найдено файлов: ${files?.length || 0}\n`)

  if (!files || files.length === 0) {
    console.log('⚠️  Нет файлов в bucket')
    return
  }

  for (const file of files) {
    console.log(`📄 Файл: ${file.name}`)
    
    // Получаем публичный URL через Supabase SDK
    const { data: publicUrlData } = supabase
      .storage
      .from('covers')
      .getPublicUrl(file.name)
    
    console.log(`   SDK URL: ${publicUrlData.publicUrl}`)
    
    // Формируем URL вручную (как в коде)
    const manualUrl = `${supabaseUrl}/storage/v1/object/public/covers/${file.name}`
    console.log(`   Manual URL: ${manualUrl}`)
    
    console.log(`   Совпадают: ${publicUrlData.publicUrl === manualUrl ? '✅' : '❌'}`)
    console.log()
  }
}

testStorageUrl().catch(console.error)

