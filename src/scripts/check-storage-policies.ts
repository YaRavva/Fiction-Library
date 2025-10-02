import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPolicies() {
  console.log('🔍 Проверка политик Storage bucket "covers"...\n')

  // Проверяем bucket
  const { data: buckets, error: bucketsError } = await supabase
    .storage
    .listBuckets()

  if (bucketsError) {
    console.error('❌ Ошибка получения buckets:', bucketsError)
    return
  }

  const coversBucket = buckets?.find(b => b.id === 'covers')
  
  if (!coversBucket) {
    console.log('❌ Bucket "covers" не найден!')
    return
  }

  console.log('✅ Bucket "covers" найден')
  console.log(`   Публичный: ${coversBucket.public ? 'Да' : 'Нет'}`)
  console.log(`   Создан: ${coversBucket.created_at}`)
  console.log()

  // Пробуем получить файл без аутентификации
  console.log('🧪 Тестирование публичного доступа...')
  
  const { data: files } = await supabase
    .storage
    .from('covers')
    .list('', { limit: 1 })

  if (!files || files.length === 0) {
    console.log('⚠️  Нет файлов для тестирования')
    return
  }

  const testFile = files[0].name
  console.log(`   Тестовый файл: ${testFile}`)

  // Получаем публичный URL
  const { data: urlData } = supabase
    .storage
    .from('covers')
    .getPublicUrl(testFile)

  console.log(`   URL: ${urlData.publicUrl}`)

  // Пробуем скачать
  const { data: downloadData, error: downloadError } = await supabase
    .storage
    .from('covers')
    .download(testFile)

  if (downloadError) {
    console.log(`   ❌ Ошибка скачивания: ${downloadError.message}`)
    console.log()
    console.log('📋 Необходимо создать политики в Supabase Dashboard:')
    console.log('   1. Откройте: https://supabase.com/dashboard/project/ygqyswivvdtpgpnxrpzl/storage/policies')
    console.log('   2. Выберите bucket "covers"')
    console.log('   3. Создайте политику "Public read access":')
    console.log('      - Policy name: Public read access for covers')
    console.log('      - Allowed operation: SELECT')
    console.log('      - Target roles: public')
    console.log('      - USING expression: true')
    console.log()
    console.log('   Или выполните SQL в SQL Editor:')
    console.log('   ```sql')
    console.log('   CREATE POLICY "Public read access for covers"')
    console.log('   ON storage.objects FOR SELECT')
    console.log('   USING (bucket_id = \'covers\');')
    console.log('   ```')
  } else {
    console.log(`   ✅ Файл успешно скачан (${downloadData.size} bytes)`)
    console.log('   ✅ Публичный доступ работает!')
  }
}

checkPolicies().catch(console.error)

