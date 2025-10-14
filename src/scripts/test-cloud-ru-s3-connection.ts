#!/usr/bin/env node

import 'dotenv/config';
import { listBuckets, uploadFile, getFile } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';

async function testConnection() {
  console.log('Тестирование подключения к S3-хранилищу cloud.ru...');
  
  try {
    await listBuckets();
    console.log('Подключение успешно!');
    
    console.log('Тестовая загрузка файла...');
    const testContent = Buffer.from('This is a test file.', 'utf-8');
    await uploadFile('books', 'test-upload.txt', testContent);
    console.log('Файл успешно загружен!');
    
    console.log('Тестовое получение файла...');
    const fileContent = await getFile('books', 'test-upload.txt');
    console.log('Содержимое полученного файла:');
    console.log(fileContent.toString('utf-8'));
  } catch (error) {
    console.error('Ошибка при тестировании подключения:', error);
    process.exit(1);
  }
}

// Выполняем тест подключения
testConnection();