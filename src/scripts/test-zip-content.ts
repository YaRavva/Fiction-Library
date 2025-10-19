import JSZip from 'jszip';
import dotenv from 'dotenv';
import { putObject } from '../lib/s3-service';

dotenv.config();

async function testZipContent() {
  try {
    console.log('🔍 Проверяем содержимое ZIP файла...');
    
    // URL файла в S3
    const fileUrl = 'https://fiction-library-1760461283197.s3.cloud.ru/4379.zip';
    
    // Загружаем файл
    console.log(`📥 Загружаем файл: ${fileUrl}`);
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      console.error(`❌ Ошибка загрузки файла: ${response.status} ${response.statusText}`);
      return;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`✅ Файл загружен. Размер: ${arrayBuffer.byteLength} байт`);
    
    // Проверяем, является ли файл корректным ZIP архивом
    const zip = new JSZip();
    console.log('📦 Пытаемся открыть ZIP архив...');
    
    try {
      const zipContent = await zip.loadAsync(arrayBuffer);
      console.log('✅ ZIP архив успешно открыт');
      
      // Показываем содержимое архива с фильтрацией
      console.log('📂 Содержимое архива (с фильтрацией):');
      let fileCount = 0;
      const fileContents: {name: string, content: string}[] = [];
      const filePromises: Promise<void>[] = [];
      
      zipContent.forEach((relativePath: string, zipEntry: JSZip.JSZipObject) => {
        // Игнорируем директории и служебные файлы macOS (как в читалке)
        if (!zipEntry.dir && 
            (relativePath.endsWith('.fb2') || relativePath.endsWith('.txt')) &&
            !relativePath.includes('__MACOSX/') &&
            !relativePath.includes('/._')) {
          fileCount++;
          console.log(`  📄 ${relativePath} (будет обработан)`);
          
          // Попробуем загрузить содержимое файла
          filePromises.push(
            zipEntry.async('text').then((content: string) => {
              fileContents.push({ name: relativePath, content });
              console.log(`    ✅ Загружен файл: ${relativePath} (${content.length} символов)`);
            }).catch((error: any) => {
              console.error(`    ❌ Ошибка загрузки файла ${relativePath}:`, error.message);
            })
          );
        } else if (!zipEntry.dir) {
          console.log(`  📄 ${relativePath} (проигнорирован)`);
        } else {
          console.log(`  📁 ${relativePath}/`);
        }
      });
      
      console.log(`📊 Всего файлов для обработки: ${fileCount}`);
      
      // Ждем завершения загрузки всех файлов
      await Promise.all(filePromises);
      
      console.log(`📊 Успешно загружено файлов: ${fileContents.length}`);
      
      // Показываем содержимое первого файла
      if (fileContents.length > 0) {
        console.log('📄 Содержимое первого файла (первые 200 символов):');
        console.log(fileContents[0].content.substring(0, 200) + '...');
      }
      
    } catch (zipError) {
      console.error('❌ Ошибка при открытии ZIP архива:', zipError);
      
      // Попробуем вывести первые 100 байт файла для диагностики
      const firstBytes = new Uint8Array(arrayBuffer.slice(0, 100));
      console.log('🔍 Первые 100 байт файла (в hex):');
      console.log(Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
    
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

testZipContent();