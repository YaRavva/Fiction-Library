'use client'

import { Book } from '@/lib/supabase'
import { DataTable } from './data-table'
import { columns } from './columns'
import { BookOpen, Download, Star } from 'lucide-react'

interface BooksTableProps {
  books: Book[]
  onBookClick?: (book: Book) => void
  onDownloadClick?: (book: Book) => void
  onReadClick?: (book: Book) => void
  onTagClick?: (tag: string) => void
}

export function BooksTable({ books, onBookClick, onDownloadClick, onReadClick, onTagClick }: BooksTableProps) {
  // Обновляем колонки с обработчиками событий и настройками ширины
  const updatedColumns = [
    // Автор column - 40px
    {
      ...columns[0], // Автор column
      size: 40,
      minSize: 40,
    },
    // Название column - немного шире
    {
      ...columns[1], // Название column
      size: 300, // немного шире
      minSize: 250,
    },
    // Рейтинг column - минимально узкий и центрированный
    {
      ...columns[2], // Рейтинг column
      size: 20, // минимально узкий
      minSize: 20,
      cell: ({ row }: { row: { getValue: (key: string) => unknown } }) => {
        const rating = row.getValue('rating') as number | undefined
        return (
          <div className="flex items-center justify-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>{rating?.toFixed(1) || '—'}</span>
          </div>
        )
      },
    },
    // Теги column - 500px
    {
      ...columns[3], // Теги column
      size: 500,
      minSize: 400,
    },
    {
      id: 'read',
      header: 'Читать',
      size: 20, // минимально узкий
      minSize: 20,
      cell: ({ row }: { row: { original: Book } }) => {
        const book = row.original
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onReadClick && onReadClick(book)
            }}
            disabled={!book.file_url}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 p-0"
          >
            <BookOpen className="h-4 w-4" />
          </button>
        )
      },
    },
    {
      id: 'download',
      header: 'Скачать',
      size: 20, // минимально узкий
      minSize: 20,
      cell: ({ row }: { row: { original: Book } }) => {
        const book = row.original
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (book.file_url) {
                // Create a custom filename in the format "author - title.zip"
                const sanitizedTitle = book.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
                const sanitizedAuthor = book.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
                const filename = `${sanitizedAuthor} - ${sanitizedTitle}.zip`;
                
                // Fetch the file and trigger download with custom filename
                fetch(book.file_url)
                  .then(response => response.blob())
                  .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  })
                  .catch(error => {
                    console.error('Error downloading file:', error);
                    // Fallback to opening in new tab if download fails
                    window.open(book.file_url, '_blank');
                  });
              }
            }}
            disabled={!book.file_url}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 p-0"
          >
            <Download className="h-4 w-4" />
          </button>
        )
      },
    },
  ]

  return (
    <DataTable 
      columns={updatedColumns} 
      data={books}
      meta={{
        onTagClick
      }}
    />
  )
}
