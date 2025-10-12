# Деплой Fiction Library на Vercel

## Подготовка к деплою

### 1. Переменные окружения

Для успешного деплоя необходимо установить следующие переменные окружения в настройках проекта на Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabASE_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Конфигурация Supabase

Убедитесь, что ваш проект Supabase настроен правильно:

1. Создана база данных с необходимыми таблицами
2. Настроен Storage с нужными buckets
3. Настроены политики доступа к данным
4. Созданы необходимые функции и триггеры

### 3. Деплой на Vercel

#### Автоматический деплой через GitHub

1. Подключите репозиторий к Vercel
2. Выберите правильную корневую директорию
3. Установите переменные окружения
4. Запустите деплой

#### Ручной деплой через CLI

```bash
# Установите Vercel CLI
npm install -g vercel

# Авторизуйтесь
vercel login

# Деплой
vercel --prod
```

### 4. Настройки проекта Vercel

В настройках проекта Vercel убедитесь, что:

- Framework Preset: Next.js
- Build Command: `next build`
- Output Directory: `.next`
- Install Command: `pnpm install`

### 5. Дополнительные настройки

#### CORS и API Routes

Приложение автоматически настроено для работы с CORS через vercel.json.

#### Image Optimization

Next.js Image Optimization работает из коробки с Vercel.

#### Serverless Functions

Все API routes и Serverless Functions будут автоматически развернуты.

## После деплоя

### 1. Проверка работы

После успешного деплоя:

1. Откройте главную страницу приложения
2. Проверьте доступ к странице авторизации
3. Проверьте доступ к API endpoints

### 2. Мониторинг

Используйте встроенные инструменты Vercel для мониторинга:

- Analytics
- Logs
- Performance monitoring

## Решение проблем

### Частые ошибки

1. **Environment Variables**: Убедитесь, что все переменные окружения установлены правильно
2. **Supabase Connection**: Проверьте настройки подключения к Supabase
3. **Build Errors**: Проверьте логи сборки на наличие ошибок

### Поддержка

Если у вас возникли проблемы с деплоем, обратитесь к документации Next.js и Vercel или создайте issue в репозитории проекта.