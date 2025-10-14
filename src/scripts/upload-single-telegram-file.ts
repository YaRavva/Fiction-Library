#!/usr/bin/env tsx

import 'dotenv/config';
import { uploadFile, createBucket } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Скрипт для загрузки отдельного файла из архива Telegram в Cloud.ru S3
 * Работает с файлом, имеющим оригинальное имя
 * Также сохраняет локальную копию файла
 */

async function uploadSingleTelegramFile(filePath: string, customName?: string) {
  console.log('🚀 Начинаем загрузку файла из архива Telegram в Cloud.ru S3');
  
  // Проверка переменных окружения
  const bucketName = process.env.S3_BUCKET_NAME || `telegram-files-${Date.now()}`;
  
  // Создаем директорию для локального бэкапа
  const backupDir = path.join(process.cwd(), 'local-backup-telegram');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log(`\n🔧 Конфигурация загрузки:`);
  console.log(`Cloud.ru Bucket: ${bucketName}`);
  console.log(`Локальный бэкап: ${backupDir}`);
  console.log(`Файл: ${filePath}`);
  
  // Проверяем, существует ли файл
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ОШИБКА: Файл не найден по пути: ${filePath}`);
    return;
  }
  
  // Получаем информацию о файле
  const fileStats = fs.statSync(filePath);
  const fileName = customName || path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  
  // Форматированный вывод информации о файле
  const fileSize = `${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`;
  console.log(`\n📄 Информация о файле:`);
  console.log(`  Имя файла: ${fileName}`);
  console.log(`  Размер: ${fileSize}`);
  
  try {
    // Создаем новый бакет для загрузки
    console.log(`\n📦 Создаем новый бакет "${bucketName}"...`);
    try {
      await createBucket(bucketName);
      console.log(`✅ Бакет "${bucketName}" успешно создан`);
    } catch (error: any) {
      console.log(`⚠️  Бакет "${bucketName}" уже существует или ошибка при создании: ${error.message}`);
    }
    
    // Определяем безопасное имя файла для S3
    const safeFileName = fileName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, '_');
    
    console.log(`\n📥 ${fileName} | ${fileSize}`);
    
    // Сохраняем локальную копию файла
    const localFilePath = path.join(backupDir, fileName);
    const localDir = path.dirname(localFilePath);
    
    // Создаем директорию, если она не существует
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    
    // Сохраняем файл локально только если он еще не существует
    if (!fs.existsSync(localFilePath)) {
      fs.writeFileSync(localFilePath, fileBuffer);
      console.log(`💾 Локальная копия сохранена: ${localFilePath}`);
    }
    
    // Загружаем файл в Cloud.ru S3
    const uploadResult = await uploadFile(bucketName, safeFileName, fileBuffer);
    
    console.log(`✅ ${fileName} | Загружен`);
    
    // Выводим итоговую информацию
    console.log('\n📊 Итоги загрузки:');
    console.log(`  ✅ Файл успешно загружен`);
    console.log(`  📄 Оригинальное имя: ${fileName}`);
    console.log(`  📁 Имя в S3: ${safeFileName}`);
    console.log(`  📏 Размер: ${fileSize}`);
    console.log(`  📂 Локальный бэкап: ${backupDir}`);
    
    console.log('\n🎉 Загрузка файла успешно завершена!');
    
  } catch (error: any) {
    console.error('\n❌ Ошибка во время загрузки файла:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск загрузки отдельного файла
if (require.main === module) {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const customName = args[1];
  
  if (!filePath) {
    console.error('❌ ОШИБКА: Не указан путь к файлу');
    console.log('Использование: tsx upload-single-telegram-file.ts <путь_к_файлу> [оригинальное_имя]');
    process.exit(1);
  }
  
  uploadSingleTelegramFile(filePath, customName)
    .then(() => {
      console.log('\n✅ Скрипт загрузки файла завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт загрузки файла завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { uploadSingleTelegramFile };