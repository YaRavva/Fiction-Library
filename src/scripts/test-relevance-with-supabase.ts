import { MetadataExtractionService } from '../lib/telegram/metadata-extraction-service';
import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

dotenv.config();

// Определяем интерфейс для книги
interface Book {
  id: string;
  title: string;
  author: string;
  file_url: string | null;
}

async function testRelevanceWithSupabase() {
  console.log('🔍 Testing relevance algorithm with real data from Supabase...');
  
  try {
    // Получаем список тестовых файлов из базы данных
    console.log('\n📚 Getting test files from database...');
    const { data: testFiles, error: filesError } = await serverSupabase
      .from('books')
      .select('file_url, title, author')
      .not('file_url', 'is', null)
      .limit(5);

    if (filesError) {
      console.error('❌ Error getting test files:', filesError);
      return;
    }

    if (!testFiles || testFiles.length === 0) {
      console.log('⚠️  No test files found in database');
      return;
    }

    console.log(`✅ Found ${testFiles.length} test files`);

    // Для каждого файла тестируем алгоритм релевантности
    for (let i = 0; i < testFiles.length; i++) {
      const file = testFiles[i] as Book;
      console.log(`\n=== Test ${i + 1} ===`);
      
      // Извлекаем имя файла из URL
      const fileName = file.file_url ? file.file_url.split('/').pop() || '' : '';
      console.log(`📄 Original file name from Telegram: ${fileName}`);
      console.log(`📘 Book title: ${file.title}`);
      console.log(`✍️  Book author: ${file.author}`);
      
      if (!fileName) {
        console.log('⚠️  File name not available, skipping...');
        continue;
      }
      
      // Извлекаем метаданные из имени файла
      const { author: extractedAuthor, title: extractedTitle } = 
        MetadataExtractionService.extractMetadataFromFilename(fileName);
      
      console.log(`🔍 Extracted metadata: "${extractedTitle}" by ${extractedAuthor}`);
      
      // Извлекаем поисковые термины
      const searchTerms = MetadataExtractionService.extractSearchTerms(fileName);
      console.log(`🔍 Search terms: [${searchTerms.join(', ')}]`);
      
      // Ищем книги в базе данных, которые могут соответствовать этим метаданным
      console.log('🔎 Searching for matching books in database...');
      
      // Поиск по названию
      const { data: titleMatches, error: titleError } = await serverSupabase
        .from('books')
        .select('id, title, author')
        .ilike('title', `%${extractedTitle}%`)
        .limit(10);
      
      if (titleError) {
        console.error('❌ Error searching by title:', titleError);
        continue;
      }
      
      // Поиск по автору
      const { data: authorMatches, error: authorError } = await serverSupabase
        .from('books')
        .select('id, title, author')
        .ilike('author', `%${extractedAuthor}%`)
        .limit(10);
      
      if (authorError) {
        console.error('❌ Error searching by author:', authorError);
        continue;
      }
      
      // Объединяем результаты и удаляем дубликаты
      const allMatches = [...(titleMatches || []), ...(authorMatches || [])];
      const uniqueMatches = allMatches.filter((bookItem: Book, index, self) => 
        index === self.findIndex((b: Book) => b.id === bookItem.id)
      );
      
      console.log(`📚 Found ${uniqueMatches.length} potential matches`);
      
      if (uniqueMatches.length === 0) {
        console.log('⚠️  No matching books found');
        continue;
      }
      
      // Применяем алгоритм релевантности
      const bestMatch = MetadataExtractionService.selectBestMatch(
        uniqueMatches,
        searchTerms,
        extractedTitle,
        extractedAuthor
      );
      
      if (bestMatch) {
        console.log(`✅ Best book match selected: "${(bestMatch as Book).title}" by ${(bestMatch as Book).author}`);
        
        // Показываем счет лучшего выбора, если он доступен
        // (в реальной реализации это будет частью логики selectBestMatch)
        console.log(`📊 Score of the best match: Calculated by algorithm`);
      } else {
        console.log('⚠️  No suitable match found by relevance algorithm');
      }
    }
    
    console.log('\n✅ Testing completed');
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Run the test
testRelevanceWithSupabase().catch(console.error);