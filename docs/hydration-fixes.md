# Исправление Ошибок Гидратации в Shadix UI

## Проблема

При интеграции Shadix UI с Next.js могут возникать ошибки гидратации React:
```
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties
```

## Причины

1. **Браузерные расширения** добавляют атрибуты к DOM элементам
2. **Клиентские компоненты** рендерятся по-разному на сервере и клиенте
3. **Анимационные библиотеки** (Framer Motion) могут вызывать расхождения
4. **Toast уведомления** рендерятся только на клиенте

## Решения

### 1. Добавить suppressHydrationWarning

В `src/app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <ToasterProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 2. Создать ToasterProvider

Создать `src/components/providers/toaster-provider.tsx`:
```tsx
"use client";

import { Toaster } from "sonner";

export function ToasterProvider() {
  return <Toaster />;
}
```

### 3. Добавить проверку isMounted

Для компонентов с анимациями:
```tsx
"use client";

import { useState, useEffect } from "react";

export default function AnimatedComponent() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div>Загрузка...</div>;
  }

  return (
    // Ваш анимированный контент
  );
}
```

### 4. Обновить Motion Dialog

Добавить проверку монтирования в `useMotionDialog`:
```tsx
const useMotionDialog = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!isMounted) return;
    // Остальная логика
  }, [isMounted]);

  return { open, onOpenChange: handleOpenChange, isAnimating, isMounted };
};
```

## Проверка Исправлений

1. Перезапустить dev сервер
2. Открыть DevTools Console
3. Проверить отсутствие ошибок гидратации
4. Протестировать анимированные компоненты

## Дополнительные Рекомендации

- Используйте `suppressHydrationWarning` только там, где это необходимо
- Всегда оборачивайте клиентские компоненты в проверку `isMounted`
- Тестируйте в разных браузерах с различными расширениями
- Используйте React DevTools для отладки гидратации

## Альтернативные Решения

Если проблемы продолжаются:

1. **Dynamic Import** для проблемных компонентов:
```tsx
import dynamic from 'next/dynamic';

const MotionDialog = dynamic(() => import('@/components/ui/motion-dialog'), {
  ssr: false
});
```

2. **Условный рендеринг** только на клиенте:
```tsx
{typeof window !== 'undefined' && <AnimatedComponent />}
```

3. **Отключение SSR** для конкретных страниц в `next.config.ts`