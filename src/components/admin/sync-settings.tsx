'use client'

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RefreshCw, Play, BookOpen } from "lucide-react"
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
    <Card className="w-full border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="space-y-0 pb-1">
        <CardTitle className="text-lg font-semibold">Синхронизация</CardTitle>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {/* Синхронизация книг и файлов */}
          <div className="space-y-1">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Синхронизация книг и файлов
            </h3>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => handleRunBookWorm("full")}
                  disabled={bookWormRunning && bookWormMode === "full"}
                  size="default"
                  className="gap-2 h-8 text-sm"
                >
                  {bookWormRunning && bookWormMode === "full" ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Выполняется...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Полная
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleRunBookWorm("update")}
                  disabled={bookWormRunning && bookWormMode === "update"}
                  variant="outline"
                  size="default"
                  className="gap-2 h-8 text-sm"
                >
                  {bookWormRunning && bookWormMode === "update" ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Обновление...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Обновление
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-background/50 p-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="book-worm-interval" className="text-sm font-medium whitespace-nowrap">
                    Таймер:
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id="book-worm-interval"
                      type="number"
                      min="5"
                      max="1440"
                      value={bookWormInterval}
                      onChange={(e) =>
                        setBookWormInterval(Math.max(5, Math.min(1440, Number.parseInt(e.target.value) || 30)))
                      }
                      className="w-16 h-8 text-sm font-mono"
                    />
                    <span className="text-sm text-muted-foreground font-medium">мин</span>
                  </div>
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
          <div className="space-y-1">
            <FileSearchManager />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}