import { Book } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'
import Image from 'next/image'

interface BookCardSmallProps {
  book: Book
  onClick?: () => void
}

export function BookCardSmall({ book, onClick }: BookCardSmallProps) {
  // Формируем URL обложки
  const coverUrl = book.cover_url || '/placeholder-cover.svg'
  
  return (
    <Card 
      className="w-full max-w-xs cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-lg">
        <Image
          src={coverUrl}
          alt={book.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <CardContent className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1">{book.title}</h3>
        <p className="text-xs text-muted-foreground mb-2">{book.author}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium">{book.rating?.toFixed(1) || '—'}</span>
          </div>
          <Badge variant="secondary" className="text-xs px-1 py-0">
            {book.file_format}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}