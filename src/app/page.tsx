import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="container px-4 flex flex-col items-center">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold">
            Fiction Library
          </h1>
          <p className="mt-4 max-w-[42rem] text-muted-foreground sm:text-xl">
            Электронная библиотека с удобной читалкой FB2 файлов
          </p>
        </div>

        <div className="grid w-full justify-center gap-4 sm:grid-cols-2 lg:grid-cols-3 md:max-w-[64rem] mt-16">
          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.library className="h-5 w-5" />
                Большая библиотека
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                До 1000 книг в формате FB2 с автоматической синхронизацией
              </p>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.reader className="h-5 w-5" />
                Удобная читалка
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Адаптивный дизайн, закладки, заметки и история чтения
              </p>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.search className="h-5 w-5" />
                Умный поиск
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Полнотекстовый поиск, рекомендации и фильтрация по жанрам
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12">
          <Button size="lg" asChild>
            <a href="/auth/login">
              Войти в библиотеку
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}