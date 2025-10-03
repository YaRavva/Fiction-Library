'use client'

import { Book } from '@/lib/supabase'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Star, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BooksTableProps {
  books: Book[]
  onBookClick?: (book: Book) => void
  onDownloadClick?: (book: Book) => void
}

export function BooksTable({ books, onBookClick, onDownloadClick }: BooksTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Обложка</TableHead>
            <TableHead>Название</TableHead>
            <TableHead>Автор</TableHead>
            <TableHead>Рейтинг</TableHead>
            <TableHead>Теги</TableHead>
            <TableHead>Формат</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {books.map((book) => (
            <TableRow 
              key={book.id} 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onBookClick?.(book)}
            >
              <TableCell>
                <div className="relative h-16 w-12 overflow-hidden rounded">
                  <img
                    src={book.cover_url || '/placeholder-cover.svg'}
                    alt={book.title}
                    className="object-cover"
                  />
                </div>
              </TableCell>
              <TableCell className="font-medium">{book.title}</TableCell>
              <TableCell>{book.author}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>{book.rating?.toFixed(1) || '—'}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {book.tags?.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {book.tags && book.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{book.tags.length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{book.file_format}</Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDownloadClick?.(book)
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}