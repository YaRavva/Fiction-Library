import { Book } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { BookOpen, Download, X } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getBrowserSupabase } from '@/lib/browserSupabase'

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
  onRead: (book: Book) => void
  onTagClick?: (tag: string) => void
  userProfile?: {
    id: string
    role: string
  } | null
  onFileClear?: (bookId: string) => void
}

export function BookCardLarge({ book, onDownload, onRead, onTagClick, userProfile, onFileClear }: BookCardLargeProps) {
  const ratingTag = book.rating ? `#выше${Math.floor(book.rating)}` : null
  const seriesComposition = book.series?.series_composition
  const seriesCoverUrls = book.series?.cover_urls

  const handleClearFile = async () => {
    if (onFileClear) {
      onFileClear(book.id)
    } else {
      // Если не передана функция onFileClear, реализуем логику здесь
      try {
        const supabase = getBrowserSupabase()
        
        // Очищаем привязку файла к книге
        const { error } = await supabase
          .from('books')
          .update({
            file_url: null,
            storage_path: null,
            file_size: null,
            file_format: null,
            telegram_file_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', book.id)

        if (error) {
          console.error('❌ Ошибка при очистке файла:', error)
          alert('Ошибка при очистке файла')
        } else {
          alert('Файл успешно очищен!')
          // Перезагружаем страницу или обновляем состояние
          window.location.reload()
        }
      } catch (error) {
        console.error('❌ Ошибка:', error)
        alert('Произошла ошибка при очистке файла')
      }
    }
  }

  return (
    // Replaced shadcn/ui Card with custom div for full layout control
    <div 
      key={book.id} 
      className="w-full max-w-3xl mx-auto border rounded-lg bg-card text-card-foreground overflow-hidden"
    >
      <div className="p-3"> {/* Using same padding as small cards */}
        {/* Header with author, title and action buttons */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm">
              <span className="font-semibold">Автор:</span> {book.author}
            </div>
            <div className="text-sm">
              <span className="font-semibold">Название:</span> {book.title}
            </div>
          </div>
          
          {/* Action buttons in top right corner */}
          <div className="flex gap-1 ml-2">
            {userProfile?.role === 'admin' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="outline" 
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={!book.file_url}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Вы уверены, что хотите очистить файл для книги "${book.title}"?`)) {
                          handleClearFile();
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Удалить файл книги</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 p-0"
                    disabled={!book.file_url}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRead(book);
                    }}
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Читать</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 p-0"
                    disabled={!book.file_url}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(book.id, book.file_url);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Скачать</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="space-y-3">
          {/* Жанр */}
          {book.genres && book.genres.length > 0 && (
            <div className="text-sm">
              <span className="font-semibold">Жанр:</span>{' '}
              <span className="inline-flex flex-wrap gap-1">
                {book.genres.map((genre, idx) => (
                  <Badge
                    key={`${book.id}-genre-${idx}`}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-secondary/80"
                    onClick={() => onTagClick && onTagClick(genre)}
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
                <Badge 
                  variant="secondary" 
                  className="text-xs cursor-pointer hover:bg-secondary/80"
                  onClick={() => onTagClick && onTagClick(ratingTag.substring(1))} // Remove # prefix
                >
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
                  <li key={`${book.id}-series-${idx}`}>
                    {item.title} ({item.year})
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Обложки - only at the bottom of the card */}
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
                      <div key={`${book.id}-cover-${idx}`} className="relative w-full overflow-hidden rounded border bg-muted">
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
        </div>
      </div>
    </div>
  )
}