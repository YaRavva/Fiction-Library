'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Book } from '@/lib/supabase'

// Define the extended column type that includes the tag click handler
type BookColumn = Book & {
  onTagClick?: (tag: string) => void
}

export const columns: ColumnDef<Book>[] = [
  {
    accessorKey: 'author',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Автор
          {column.getIsSorted() === 'asc' ? ' ↑' : ' ↓'}
        </Button>
      )
    },
    cell: ({ row }) => {
      return (
        <div className="font-bold">
          {row.getValue('author')}
        </div>
      )
    },
  },
  {
    accessorKey: 'title',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Название
          {column.getIsSorted() === 'asc' ? ' ↑' : ' ↓'}
        </Button>
      )
    },
    cell: ({ row }) => {
      return (
        <div className="font-bold">
          {row.getValue('title')}
        </div>
      )
    },
  },
  {
    accessorKey: 'rating',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Рейтинг
          {column.getIsSorted() === 'asc' ? ' ↑' : ' ↓'}
        </Button>
      )
    },
    cell: ({ row }) => {
      const rating = row.getValue('rating') as number | undefined
      return rating && rating > 0 ? (
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span>{rating.toFixed(1)}</span>
        </div>
      ) : null
    },
  },
  {
    accessorKey: 'tags',
    header: 'Теги',
    cell: ({ row, table }) => {
      const tags = row.getValue('tags') as string[] | undefined
      // Get the tag click handler from table options if available
      const onTagClick = (table.options.meta as { onTagClick?: (tag: string) => void })?.onTagClick
      
      return (
        <div className="flex flex-wrap gap-1">
          {tags?.map((tag, index) => (
            <Badge 
              key={`${row.original.id}-${tag}-${index}`} 
              variant="secondary" 
              className="text-xs cursor-pointer hover:bg-secondary/80"
              onClick={() => onTagClick && onTagClick(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )
    },

  },
]
