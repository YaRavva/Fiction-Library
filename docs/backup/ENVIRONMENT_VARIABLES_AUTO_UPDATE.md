# Переменные окружения для автообновления Книжного Червя

## Обязательные переменные

### BOOKWORM_GITHUB_ACTION_TOKEN
- **Назначение**: токен для аутентификации вызовов из GitHub Actions
- **Тип**: строка (рекомендуется использовать длинный случайный токен)
- **Пример**: `BOOKWORM_GITHUB_ACTION_TOKEN=abc123def456ghi789...`
- **Описание**: Этот токен используется для аутентификации вызовов API из GitHub Actions. Должен совпадать с токеном, указанным в секретах GitHub репозитория.

## Настройка GitHub Actions

1. Добавьте токен в GitHub Secrets:
   - Перейдите в Settings репозитория
   - Выберите Secrets and variables → Actions
   - Добавьте новый secret с названием `BOOKWORM_GITHUB_ACTION_TOKEN`

2. Убедитесь, что в workflow файле используется тот же токен:
   ```yaml
   - name: Call BookWorm Auto Update API
     run: |
       curl -X POST "${{ secrets.BOOKWORM_API_URL }}/api/admin/book-worm/auto-update" \
         -H "Content-Type: application/json" \
         -H "X-GitHub-Token: ${{ secrets.BOOKWORM_GITHUB_ACTION_TOKEN }}" \
         -d '{"source": "github-action"}'
   ```

## Настройка в Vercel

При деплое на Vercel убедитесь, что переменная `BOOKWORM_GITHUB_ACTION_TOKEN` установлена в настройках проекта:
- В Vercel Dashboard перейдите в Settings → Environment Variables
- Добавьте переменную `BOOKWORM_GITHUB_ACTION_TOKEN` с тем же значением, что и в GitHub Secrets