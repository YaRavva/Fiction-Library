# Работа с облачной Supabase без локального CLI

## Общее описание

В проекте используется облачная версия Supabase, что означает отсутствие необходимости в локальном Supabase CLI. Все операции с базой данных выполняются через клиентскую библиотеку Supabase с использованием переменных окружения из файла `.env`.

## Переменные окружения

Все необходимые переменные окружения для работы с Supabase находятся в файле `.env` в корне проекта:

```env
# URL проекта Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yobwiopkewzyrabwzzgo.supabase.co

# Анонимный ключ (для клиентских приложений)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYndpb3BrZXd6eXJhYnd6emdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MjkyNjYsImV4cCI6MjA3NjEwNTI2Nn0.Ngzs79vx5OWSVC8KYwlh4Cs19HS29E-dNzkkxvcPkRU

# Ключ сервисной роли (для серверных скриптов)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYndpb3BrZXd6eXJhYnd6emdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUyOTI2NiwiZXhwIjoyMDc2MTA1MjY2fQ.lCU-HXGgFApKtCG_3YWAgB_rTmX02x9iVuodaoT9-LI
```

## Подключение к Supabase в скриптах

### Использование serverSupabase

Для серверных скриптов используется специальный прокси-клиент `serverSupabase`, который автоматически инициализируется с правильными переменными окружения:

```typescript
import { serverSupabase } from '../lib/serverSupabase';

// Пример использования
const { data, error } = await serverSupabase
  .from('books')
  .select('*')
  .limit(10);
```

### serverSupabase.ts

Файл [/src/lib/serverSupabase.ts](file:///c:/Users/Ravva/Fiction-Library/src/lib/serverSupabase.ts) содержит реализацию прокси-клиента:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Откладываем проверку переменных окружения до момента создания клиента
let supabaseUrl: string | undefined;
let serviceRoleKey: string | undefined;

function initializeEnv() {
  supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// Define a type for our target object
interface TargetObject {
  _client?: SupabaseClient;
}

export const serverSupabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    // Инициализируем переменные окружения при первом обращении
    if (!supabaseUrl || !serviceRoleKey) {
      initializeEnv();
    }
    
    // Проверяем переменные окружения
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
    }
    
    // Создаем клиент при первом обращении
    const typedTarget = target as TargetObject;
    if (!typedTarget._client) {
      typedTarget._client = createClient(supabaseUrl, serviceRoleKey);
    }
    
    // Перенаправляем вызовы к реальному клиенту
    return typedTarget._client[prop as keyof SupabaseClient];
  }
});
```

## Примеры использования

### Получение данных

```typescript
import { serverSupabase } from '../lib/serverSupabase';

async function getBooks() {
  const { data, error } = await serverSupabase
    .from('books')
    .select('id, title, author')
    .limit(100);
    
  if (error) {
    console.error('Error:', error);
    return [];
  }
  
  return data;
}
```

### Вставка данных

```typescript
import { serverSupabase } from '../lib/serverSupabase';

async function addBook(book: { title: string; author: string }) {
  const { data, error } = await serverSupabase
    .from('books')
    .insert([book])
    .select();
    
  if (error) {
    console.error('Error:', error);
    return null;
  }
  
  return data[0];
}
```

### Обновление данных

```typescript
import { serverSupabase } from '../lib/serverSupabase';

async function updateBook(id: string, updates: Partial<{ title: string; author: string }>) {
  const { data, error } = await serverSupabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .select();
    
  if (error) {
    console.error('Error:', error);
    return null;
  }
  
  return data[0];
}
```

### Удаление данных

```typescript
import { serverSupabase } from '../lib/serverSupabase';

async function deleteBook(id: string) {
  const { error } = await serverSupabase
    .from('books')
    .delete()
    .eq('id', id);
    
  if (error) {
    console.error('Error:', error);
    return false;
  }
  
  return true;
}
```

## Создание скриптов

При создании новых скриптов:

1. Импортируйте `serverSupabase`:
```typescript
import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

dotenv.config(); // Загружаем переменные окружения
```

2. Используйте клиент для работы с базой данных:
```typescript
const { data, error } = await serverSupabase.from('table_name').select('*');
```

3. Обрабатывайте ошибки:
```typescript
if (error) {
  console.error('Database error:', error);
  return;
}
```

## Запуск скриптов

Скрипты запускаются с помощью `npx tsx`:

```bash
npx tsx src/scripts/your-script.ts
```

Убедитесь, что файл `.env` находится в корне проекта и содержит все необходимые переменные окружения.

## Безопасность

- Никогда не публикуйте файл `.env` в репозитории
- Используйте `SUPABASE_SERVICE_ROLE_KEY` только в серверных скриптах
- Для клиентских приложений используйте `NEXT_PUBLIC_SUPABASE_ANON_KEY`