import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixBucket() {
  console.log('🔧 Исправление настроек bucket "covers"...\n')

  // Обновляем bucket на публичный
  const { data, error } = await supabase
    .storage
    .updateBucket('covers', {
      public: true
    })

  if (error) {
    console.error('❌ Ошибка обновления bucket:', error)
    return
  }

  console.log('✅ Bucket "covers" обновлен на публичный')
  console.log()

  // Проверяем
  const { data: buckets } = await supabase
    .storage
    .listBuckets()

  const coversBucket = buckets?.find(b => b.id === 'covers')
  
  if (coversBucket) {
    console.log('📊 Текущие настройки:')
    console.log(`   Публичный: ${coversBucket.public ? 'Да ✅' : 'Нет ❌'}`)
    console.log(`   ID: ${coversBucket.id}`)
    console.log(`   Имя: ${coversBucket.name}`)
  }
}

fixBucket().catch(console.error)

