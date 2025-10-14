#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { uploadFile, createBucket } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Скрипт для загрузки файлов из архива Telegram в Cloud.ru S3
 * Работает с файлами, имеющими оригинальные имена
 * Также сохраняет локальные копии файлов
 */

// Максимальное количество одновременных загрузок
const MAX_CONCURRENT_UPLOADS = 5;

interface TelegramFile {
  id: string;
  name: string;
  path: string;
  size: number;
}

async function uploadTelegramArchive(archivePath: string) {
  console.log('🚀 Начинаем загрузку файлов из архива Telegram в Cloud.ru S3');
  
  // Проверка переменных окружения
  const bucketName = process.env.S3_BUCKET_NAME || `telegram-archive-${Date.now()}`;
  
  // Создаем директорию для локального бэкапа
  const backupDir = path.join(process.cwd(), 'local-backup-telegram');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log(`\n🔧 Конфигурация загрузки:`);
  console.log(`Cloud.ru Bucket: ${bucketName}`);
  console.log(`Архив Telegram: ${archivePath}`);
  console.log(`Локальный бэкап: ${backupDir}`);
  console.log(`Максимум одновременных загрузок: ${MAX_CONCURRENT_UPLOADS}`);
  
  // Проверяем, существует ли архив
  if (!fs.existsSync(archivePath)) {
    console.error(`❌ ОШИБКА: Архив не найден по пути: ${archivePath}`);
    return;
  }
  
  // Получаем список файлов из архива
  console.log('\n📁 Сканируем архив Telegram...');
  const telegramFiles = await scanTelegramArchive(archivePath);
  
  if (telegramFiles.length === 0) {
    console.log('ℹ️  В архиве не найдено файлов для загрузки');
    return;
  }
  
  console.log(`✅ Найдено ${telegramFiles.length} файлов для загрузки`);
  
  try {
    // Создаем новый бакет для загрузки
    console.log(`\n📦 Создаем новый бакет "${bucketName}"...`);
    try {
      await createBucket(bucketName);
      console.log(`✅ Бакет "${bucketName}" успешно создан`);
    } catch (error: any) {
      console.log(`⚠️  Бакет "${bucketName}" уже существует или ошибка при создании: ${error.message}`);
    }
    
    // Счетчики для статистики
    let uploadedCount = 0;
    let errorCount = 0;
    
    console.log('\n🔄 Начинаем параллельную загрузку файлов...');
    
    // Обрабатываем файлы порциями для контроля нагрузки
    for (let i = 0; i < telegramFiles.length; i += MAX_CONCURRENT_UPLOADS) {
      const batch = telegramFiles.slice(i, i + MAX_CONCURRENT_UPLOADS);
      const batchNumber = Math.floor(i / MAX_CONCURRENT_UPLOADS) + 1;
      const totalBatches = Math.ceil(telegramFiles.length / MAX_CONCURRENT_UPLOADS);
      
      console.log(`\n📦 Обработка пакета ${batchNumber}/${totalBatches} (${batch.length} файлов)`);
      
      // Создаем массив промисов для параллельной обработки
      const uploadPromises = batch.map(async (tgFile) => {
        try {
          // Читаем файл из архива
          const fileBuffer = fs.readFileSync(tgFile.path);
          
          // Определяем безопасное имя файла для S3
          const safeFileName = tgFile.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, '_');
          
          // Форматированный вывод информации о файле
          const fileSize = `${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`;
          console.log(`  📥 ${tgFile.name} | ${fileSize}`);
          
          // Сохраняем локальную копию файла
          const localFilePath = path.join(backupDir, tgFile.name);
          const localDir = path.dirname(localFilePath);
          
          // Создаем директорию, если она не существует
          if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
          }
          
          // Сохраняем файл локально только если он еще не существует
          if (!fs.existsSync(localFilePath)) {
            fs.writeFileSync(localFilePath, fileBuffer);
            console.log(`  💾 Локальная копия сохранена: ${localFilePath}`);
          }
          
          // Загружаем файл в Cloud.ru S3
          const uploadResult = await uploadFile(bucketName, safeFileName, fileBuffer);
          
          return { 
            success: true, 
            fileName: tgFile.name, 
            safeFileName: safeFileName,
            size: fileBuffer.length
          };
        } catch (error: any) {
          return { success: false, fileName: tgFile.name, error: error.message };
        }
      });
      
      // Выполняем параллельную загрузку файлов в текущем пакете
      const results = await Promise.all(uploadPromises);
      
      // Обновляем счетчики и выводим информацию
      results.forEach(result => {
        if (result.success) {
          uploadedCount++;
          console.log(`  ✅ ${result.fileName} | Загружен`);
        } else {
          errorCount++;
          console.log(`  ❌ ${result.fileName} | Ошибка: ${result.error}`);
        }
      });
      
      // Выводим промежуточные результаты
      console.log(`  📊 Промежуточные результаты пакета:`);
      console.log(`    ✅ Успешно: ${results.filter(r => r.success).length}`);
      console.log(`    ❌ Ошибок: ${results.filter(r => !r.success).length}`);
      
      // Добавляем небольшую задержку между пакетами для стабильности
      if (i + MAX_CONCURRENT_UPLOADS < telegramFiles.length) {
        console.log(`  ⏳ Пауза перед следующим пакетом...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Выводим итоговую статистику
    console.log('\n📊 Итоги загрузки файлов из архива Telegram:');
    console.log(`  ✅ Успешно загружено: ${uploadedCount} файлов`);
    console.log(`  ❌ Ошибок: ${errorCount} файлов`);
    console.log(`  📚 Всего обработано: ${telegramFiles.length} файлов`);
    console.log(`  📂 Локальный бэкап: ${backupDir}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Загрузка файлов из архива Telegram успешно завершена!');
    } else {
      console.log(`\n⚠️  Загрузка файлов из архива Telegram завершена с ${errorCount} ошибками`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка во время загрузки файлов:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

/**
 * Сканирует архив Telegram и возвращает список файлов
 * @param archivePath Путь к архиву Telegram
 * @returns Список файлов
 */
async function scanTelegramArchive(archivePath: string): Promise<TelegramFile[]> {
  const files: TelegramFile[] = [];
  
  // Если это директория, сканируем её рекурсивно
  if (fs.statSync(archivePath).isDirectory()) {
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = fs.statSync(entryPath);
        
        if (stat.isDirectory()) {
          walk(entryPath);
        } else {
          // Добавляем только файлы с расширениями книжных форматов
          const ext = path.extname(entry).toLowerCase();
          const bookExtensions = ['.fb2', '.zip', '.txt', '.pdf', '.epub'];
          
          if (bookExtensions.includes(ext)) {
            files.push({
              id: path.relative(archivePath, entryPath).replace(/\\/g, '_'),
              name: entry,
              path: entryPath,
              size: stat.size
            });
          }
        }
      }
    };
    
    walk(archivePath);
  } else {
    console.log('ℹ️  Указанный путь не является директорией. Для загрузки отдельного файла используйте другой скрипт.');
  }
  
  return files;
}

// Запуск загрузки архива Telegram
if (require.main === module) {
  const args = process.argv.slice(2);
  const archivePath = args[0];
  
  if (!archivePath) {
    console.error('❌ ОШИБКА: Не указан путь к архиву Telegram');
    console.log('Использование: tsx upload-telegram-archive.ts <путь_к_архиву>');
    process.exit(1);
  }
  
  uploadTelegramArchive(archivePath)
    .then(() => {
      console.log('\n✅ Скрипт загрузки архива Telegram завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт загрузки архива Telegram завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { uploadTelegramArchive };