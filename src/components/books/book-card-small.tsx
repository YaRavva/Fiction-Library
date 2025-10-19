import { Book } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Star, BookOpen, Download } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface BookCardSmallProps {
  book: Book
  onClick: () => void
  onRead: (book: Book) => void
  onDownload: (book: Book) => void
  onTagClick?: (tag: string) => void
  onSelect?: (book: Book) => void
}

export function BookCardSmall({ book, onClick, onRead, onDownload, onTagClick, onSelect }: BookCardSmallProps) {
  const router = useRouter()
  
  // Формируем URL обложки
  let coverUrl = book.cover_url || '/placeholder-cover.svg';
  
  // Проверяем, является ли обложка из Cloud.ru S3
  if (book.cover_url && book.cover_url.includes('s3.cloud.ru')) {
    // Для публичного бакета используем прямую ссылку, как в больших карточках
    coverUrl = book.cover_url;
  }
  
  // Проверяем, является ли обложка тройной
  const isTripleCover = () => {
    return coverUrl.includes('cc917838ccbb10846543e') || // цикл Луна
           coverUrl.includes('3109e8fdf303b46ee64f1');   // цикл Одаренные
  };

  return (
    <div 
      className="w-full max-w-xs cursor-pointer hover:shadow-md transition-shadow flex flex-col h-full border rounded-lg bg-card text-card-foreground"
      onClick={(e) => {
        // Проверяем, был ли клик по обложке или пустому пространству внутри карточки
        if (onSelect) {
          onSelect(book);
        } else {
          // Переходим на страницу книги
          router.push(`/library/book?id=${book.id}`);
        }
      }}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-lg">
        {isTripleCover() ? (
          // Для тройных обложек показываем только левую треть
          <div className="relative w-full h-full overflow-hidden" style={{ width: '33.33%', height: '100%' }}>
            <Image
              src={coverUrl}
              alt={book.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              style={{
                width: '300%',
                left: '0'
              }}
            />
          </div>
        ) : (
          // Для обычных обложек показываем как есть
          <Image
            src={coverUrl}
            alt={book.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        )}
      </div>
      <div className="p-3 flex-grow flex flex-col">
        <div className="text-sm flex-grow">
          <div className="font-semibold truncate">Автор: {book.author}</div>
          <div className="font-semibold truncate">Название: {book.title}</div>
        </div>
        
        {/* Жанры */}
        {book.genres && book.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {book.genres.slice(0, 3).map((genre, idx) => (
              <span
                key={`${book.id}-genre-${idx}`}
                className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded cursor-pointer hover:bg-secondary/80"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick && onTagClick(genre);
                }}
              >
                #{genre}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex items-center gap-1">
            {book.rating && book.rating > 0 && (
              <>
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-medium">{book.rating.toFixed(1)}</span>
              </>
            )}
          </div>
          <div className="flex gap-1">
            <Button 
              size="icon" 
              variant="outline" 
              className="h-6 w-6 p-0"
              disabled={!book.file_url}
              onClick={(e) => {
                e.stopPropagation();
                onRead(book);
              }}
            >
              <BookOpen className="h-3 w-3" />
            </Button>
            <Button 
              size="icon" 
              variant="outline" 
              className="h-6 w-6 p-0"
              disabled={!book.file_url}
              onClick={(e) => {
                e.stopPropagation();
                onDownload(book);
              }}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}