// Загружаем переменные окружения из .env файла
import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из файла .env в корне проекта
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

// Используем те же переменные окружения, что и в основном приложении
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют необходимые переменные окружения:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'не задан');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey || 'не задан');
  console.error('\nПожалуйста, убедитесь, что переменные окружения установлены.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Правильный состав серии для "Елизавета Дворецкая - цикл Корабль во фьорде"
const correctSeriesComposition = [
  { title: "Стоячие камни", year: 1997 },
  { title: "Спящее золото", year: 2003 },
  { title: "Щит побережья", year: 2004 },
  { title: "Корни гор", year: 2004 },
  { title: "Ведьмина звезда", year: 2002 },
  { title: "Перстень альвов", year: 2006 },
  { title: "Ясень и яблоня", year: 2008 },
  { title: "Дракон восточного моря", year: 2008 },
  { title: "Волк в ночи", year: 2020 },
  { title: "Крепость Теней", year: 2021 },
  { title: "Каменный Трон", year: 2021 },
  { title: "Лань в чаще", year: 2008 }
];

async function updateSeriesComposition() {
  try {
    console.log('🚀 Начинаем обновление состава серии для "Елизавета Дворецкая - цикл Корабль во фьорде"');
    
    // Получаем книгу
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('title', 'цикл Корабль во фьорде')
      .eq('author', 'Елизавета Дворецкая')
      .single();
    
    if (bookError) {
      console.error('❌ Ошибка при получении книги:', bookError);
      return;
    }
    
    if (!book) {
      console.log('❌ Книга "Елизавета Дворецкая - цикл Корабль во фьорде" не найдена в базе данных');
      return;
    }
    
    console.log(`📚 Найдена книга:`);
    console.log(`- ID: ${book.id}`);
    console.log(`- Название: ${book.title}`);
    console.log(`- Автор: ${book.author}`);
    console.log(`- Series ID: ${book.series_id || 'не привязана'}`);
    
    // Проверяем, привязана ли книга к серии
    if (!book.series_id) {
      console.log('❌ Книга не привязана к серии');
      return;
    }
    
    // Получаем информацию о серии
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select('*')
      .eq('id', book.series_id)
      .single();
    
    if (seriesError) {
      console.error('❌ Ошибка при получении информации о серии:', seriesError);
      return;
    }
    
    console.log(`\n📚 Информация о серии:`);
    console.log(`- ID: ${series.id}`);
    console.log(`- Название: ${series.title}`);
    console.log(`- Автор: ${series.author}`);
    
    const currentComposition = series.series_composition || [];
    console.log(`- Текущий состав: ${currentComposition.length} книг`);
    
    // Обновляем состав серии
    console.log(`\n🔄 Обновляем состав серии...`);
    
    const { error: updateError } = await supabase
      .from('series')
      .update({ 
        series_composition: correctSeriesComposition,
        title: "цикл Корабль во фьорде",
        author: "Елизавета Дворецкая"
      })
      .eq('id', book.series_id);
    
    if (updateError) {
      console.error('❌ Ошибка при обновлении состава серии:', updateError);
      return;
    }
    
    console.log(`✅ Состав серии успешно обновлен`);
    console.log(`\n📋 Новый состав серии:`);
    correctSeriesComposition.forEach((book, index) => {
      console.log(`  ${index + 1}. ${book.title} (${book.year})`);
    });
    
    console.log('\n✅ Скрипт завершен!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
updateSeriesComposition();