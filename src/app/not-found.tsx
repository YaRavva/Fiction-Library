import Link from "next/link"
import { Icons } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="container relative grid min-h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-1 lg:px-0">
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col items-center space-y-4 text-center">
            <Icons.alertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="flex flex-col space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Страница не найдена
              </h1>
              <p className="text-sm text-muted-foreground">
                Запрашиваемая страница не существует или была перемещена.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/">
                На главную
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/library">
                К библиотеке
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}