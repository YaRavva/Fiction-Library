import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyPolicies() {
  console.log('🔧 Применение политик доступа к Storage...\n')

  const policies = [
    {
      name: 'Public read access for covers',
      sql: `
        CREATE POLICY IF NOT EXISTS "Public read access for covers"
        ON storage.objects
        FOR SELECT
        USING (bucket_id = 'covers');
      `
    },
    {
      name: 'Authenticated users can upload covers',
      sql: `
        CREATE POLICY IF NOT EXISTS "Authenticated users can upload covers"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'covers');
      `
    },
    {
      name: 'Authenticated users can update covers',
      sql: `
        CREATE POLICY IF NOT EXISTS "Authenticated users can update covers"
        ON storage.objects
        FOR UPDATE
        TO authenticated
        USING (bucket_id = 'covers')
        WITH CHECK (bucket_id = 'covers');
      `
    },
    {
      name: 'Authenticated users can delete covers',
      sql: `
        CREATE POLICY IF NOT EXISTS "Authenticated users can delete covers"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (bucket_id = 'covers');
      `
    }
  ]

  for (const policy of policies) {
    console.log(`📝 Создание политики: ${policy.name}`)
    
    const { error } = await supabase.rpc('exec_sql', { sql: policy.sql })
    
    if (error) {
      console.error(`   ❌ Ошибка: ${error.message}`)
    } else {
      console.log(`   ✅ Успешно`)
    }
  }

  console.log('\n🔍 Проверка политик...')
  
  const { data, error } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'objects')
    .like('policyname', '%covers%')

  if (error) {
    console.error('❌ Ошибка проверки:', error)
  } else {
    console.log(`✅ Найдено политик: ${data?.length || 0}`)
    data?.forEach(policy => {
      console.log(`   - ${policy.policyname}`)
    })
  }
}

applyPolicies().catch(console.error)

