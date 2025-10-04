'use client'

import { Book } from '@/lib/supabase'
import { DataTable } from './data-table'
import { columns } from './columns'
import { BookOpen, Download } from 'lucide-react'

interface BooksTableProps {
  books: Book[]
  onBookClick?: (book: Book) => void
  onDownloadClick?: (book: Book) => void
  onReadClick?: (book: Book) => void
  onTagClick?: (tag: string) => void
}

export function BooksTable({ books, onBookClick, onDownloadClick, onReadClick, onTagClick }: BooksTableProps) {
  // Обновляем колонки с обработчиками событий
  const updatedColumns = [
    ...columns,
    {
      id: 'read',
      header: 'Читать',
      cell: ({ row }: { row: { original: Book } }) => {
        const book = row.original
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (book.file_url) {
                window.open(book.file_url, '_blank')
              }
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
      cell: ({ row }: { row: { original: Book } }) => {
        const book = row.original
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (book.file_url) {
                window.open(book.file_url, '_blank')
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