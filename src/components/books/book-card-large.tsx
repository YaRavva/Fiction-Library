import { Book } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { Download } from 'lucide-react'

interface BookCardLargeProps {
  book: Book & {
    series?: {
      id: string
      title: string
      author: string
      series_composition?: { title: string; year: number }[]
      cover_urls?: string[]
    }
  }
  onDownload: (bookId: string, fileUrl: string | undefined) => void
}

export function BookCardLarge({ book, onDownload }: BookCardLargeProps) {
  const ratingTag = book.rating ? `#выше${Math.floor(book.rating)}` : null
  const seriesComposition = book.series?.series_composition
  const seriesCoverUrls = book.series?.cover_urls

  return (
    <Card key={book.id} className="overflow-hidden">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Автор и Название */}
          <div className="space-y-1">
            <div className="text-sm">
              <span className="font-semibold">Автор:</span> {book.author}
            </div>
            <div className="text-sm">
              <span className="font-semibold">Название:</span> {book.title}
            </div>
          </div>

          {/* Жанр */}
          {book.genres && book.genres.length > 0 && (
            <div className="text-sm">
              <span className="font-semibold">Жанр:</span>{' '}
              <span className="inline-flex flex-wrap gap-1">
                {book.genres.map((genre, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-secondary/80"
                  >
                    #{genre}
                  </Badge>
                ))}
              </span>
            </div>
          )}

          {/* Рейтинг */}
          {book.rating && (
            <div className="text-sm">
              <span className="font-semibold">Рейтинг:</span> {book.rating.toFixed(2)}{' '}
              {ratingTag && (
                <Badge variant="secondary" className="text-xs">
                  {ratingTag}
                </Badge>
              )}
            </div>
          )}

          {/* Описание */}
          {book.description && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {book.description}
            </p>
          )}

          {/* Состав серии */}
          {seriesComposition && seriesComposition.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">Состав:</div>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                {seriesComposition.map((item, idx) => (
                  <li key={idx}>
                    {item.title} ({item.year})
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Обложки - только внизу карточки */}
          {(book.cover_url || (seriesCoverUrls && seriesCoverUrls.length > 0)) && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2">
                {/* Если есть обложки серии, показываем их */}
                {seriesCoverUrls && seriesCoverUrls.length > 0 ? (
                  seriesCoverUrls.map((coverUrl, idx) => {
                    // Определяем, является ли обложка широкой (тройной) по соотношению сторон
                    const isWideCover = () => {
                      // Проверяем по URL (старый способ)
                      if (coverUrl.includes('cc917838ccbb10846543e') || // цикл Луна
                          coverUrl.includes('3109e8fdf303b46ee64f1')) { // цикл Одаренные
                        return true;
                      }

                      // TODO: В будущем можно добавить динамическую проверку размеров изображения
                      // Пока что для тестирования считаем широкими обложки с определенными характеристиками
                      return false;
                    };

                    const wideCover = isWideCover();

                    return (
                      <div key={idx} className="relative w-full overflow-hidden rounded border bg-muted">
                        {wideCover ? (
                          // Широкие (тройные) обложки показываем в полную ширину без блюра по бокам
                          // Используем object-cover для обрезки по краям
                          <div className="relative w-full" style={{ aspectRatio: '2/3' }}>
                            <Image
                              src={coverUrl}
                              alt={`Обложка ${idx + 1}`}
                              fill
                              className="object-cover"
                              unoptimized
                              sizes="(max-width: 640px) 100vw, 384px"
                            />
                          </div>
                        ) : (
                          // Для одинарных обложек используем фиксированную высоту 480px с блюром по бокам
                          <div className="relative w-full h-[480px]">
                            {/* Блюр-эффект по бокам, если ширина изображения меньше контейнера */}
                            <div className="absolute inset-0">
                              <Image
                                src={coverUrl}
                                alt={`Обложка ${idx + 1}`}
                                fill
                                className="object-cover scale-110 blur-sm opacity-30"
                                unoptimized
                                sizes="(max-width: 640px) 100vw, 384px"
                              />
                            </div>
                            {/* Основная обложка по центру */}
                            <div className="relative w-full h-full flex items-center justify-center">
                              <div style={{ 
                                height: '480px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                              }}>
                                <img
                                  src={coverUrl}
                                  alt={`Обложка ${idx + 1}`}
                                  style={{
                                    maxHeight: '480px',
                                    maxWidth: '100%',
                                    objectFit: 'contain'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Если нет обложек серии, но есть обложка книги
                  book.cover_url && (
                    <div className="relative w-full overflow-hidden rounded border bg-muted">
                      {/* Контейнер фиксированной высоты 480px */}
                      <div className="relative w-full h-[480px]">
                        {/* Блюр-эффект по бокам, если ширина изображения меньше контейнера */}
                        <div className="absolute inset-0">
                          <Image
                            src={book.cover_url}
                            alt={book.title}
                            fill
                            className="object-cover scale-110 blur-sm opacity-30"
                            unoptimized
                            sizes="(max-width: 640px) 100vw, 384px"
                          />
                        </div>
                        {/* Основная обложка по центру */}
                        <div className="relative w-full h-full flex items-center justify-center">
                          <div style={{ 
                            height: '480px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}>
                            <img
                              src={book.cover_url}
                              alt={book.title}
                              style={{
                                maxHeight: '480px',
                                maxWidth: '100%',
                                objectFit: 'contain'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Кнопка скачивания */}
          {book.file_url && (
            <Button
              className="w-full"
              onClick={() => onDownload(book.id, book.file_url)}
            >
              <Download className="mr-2 h-4 w-4" />
              Скачать
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}