'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { FileSearchManager } from './file-search-manager'

interface SyncSettingsProps {
  bookWormRunning: boolean
  bookWormMode: 'full' | 'update' | null
  bookWormInterval: number
  bookWormAutoUpdate: boolean
  handleRunBookWorm: (mode: 'full' | 'update') => void
  handleToggleAutoUpdate: (checked: boolean) => void
  setBookWormInterval: (interval: number) => void
}

export function SyncSettings({
  bookWormRunning,
  bookWormMode,
  bookWormInterval,
  bookWormAutoUpdate,
  handleRunBookWorm,
  handleToggleAutoUpdate,
  setBookWormInterval
}: SyncSettingsProps) {
  return (
    <div className="w-full p-6">
      <div className="w-full space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Синхронизация</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 items-start justify-center">
          {/* Синхронизация книг и файлов */}
          <div className="space-y-3 w-full">
            <h2 className="text-base font-medium">Синхронизация книг и файлов</h2>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  onClick={() => handleRunBookWorm("full")}
                  disabled={bookWormRunning && bookWormMode === "full"}
                  size="default"
                >
                  {bookWormRunning && bookWormMode === "full" ? "Выполняется..." : "Полная"}
                </Button>

                <Button
                  onClick={() => handleRunBookWorm("update")}
                  disabled={bookWormRunning && bookWormMode === "update"}
                  variant="outline"
                  size="default"
                >
                  {bookWormRunning && bookWormMode === "update" ? "Обновление..." : "Обновление"}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="book-worm-interval" className="text-sm font-medium whitespace-nowrap">
                    Таймер:
                  </Label>
                  <Input
                    id="book-worm-interval"
                    type="number"
                    min="5"
                    max="1440"
                    value={bookWormInterval}
                    onChange={(e) =>
                      setBookWormInterval(Math.max(5, Math.min(1440, Number.parseInt(e.target.value) || 30)))
                    }
                    className="w-20 h-9 text-sm font-mono"
                  />
                  <span className="text-sm text-muted-foreground font-medium">мин</span>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="auto-update" checked={bookWormAutoUpdate} onCheckedChange={handleToggleAutoUpdate} />
                  <label
                    htmlFor="auto-update"
                    className="text-sm font-medium leading-none cursor-pointer select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Автообновление
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Полуавтоматический поиск файлов */}
          <div className="space-y-3 w-full">
            <h2 className="text-base font-medium">Полуавтоматический поиск файлов</h2>
            <FileSearchManager />
          </div>
        </div>
      </div>
    </div>
  )
}