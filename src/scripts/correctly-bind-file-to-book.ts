#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function correctlyBindFileToBook() {
  console.log('=== Корректная привязка файла 1039.zip к книге ===');
  
  // Создание клиента Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ОШИБКА: Не установлены переменные окружения Supabase');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const messageId = '1039'; // Это message_id из приватного канала файлов
    const fileName = '1039.zip';
    
    // Проверяем, что файл существует локально (мы его скачали ранее)
    const localFilePath = `./src/scripts/${fileName}`;
    if (!fs.existsSync(localFilePath)) {
      console.error(`❌ ОШИБКА: Локальный файл ${fileName} не найден`);
      return;
    }
    
    // Получаем размер файла
    const fileStats = fs.statSync(localFilePath);
    const fileSize = fileStats.size;
    console.log(`Размер файла: ${fileSize} байт`);
    
    console.log(`\n1. Поиск записи в telegram_processed_messages с telegram_file_id = ${messageId}...`);
    let { data: processedMessage, error: searchError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .eq('telegram_file_id', messageId)
      .single();
    
    if (processedMessage && !searchError) {
      console.log('✅ Найдена запись в telegram_processed_messages:');
      console.log(`  ID: ${processedMessage.id}`);
      console.log(`  Book ID: ${processedMessage.book_id}`);
      console.log(`  Message ID: ${processedMessage.message_id}`);
      
      // Получаем информацию о книге
      console.log('\n2. Получение информации о книге...');
      let { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', processedMessage.book_id)
        .single();
      
      if (book && !bookError) {
        console.log('✅ Найдена книга:');
        console.log(`  Название: ${book.title}`);
        console.log(`  Автор: ${book.author}`);
        console.log(`  ID: ${book.id}`);
        
        // Обновляем информацию о файле книги
        console.log('\n3. Обновление информации о файле книги...');
        
        const updateData = {
          file_url: `https://s3.cloud.ru/books/${fileName}`,
          file_size: fileSize,
          file_format: 'zip',
          telegram_file_id: messageId, // Это ID файла из приватного канала
          storage_path: `books/${fileName}`
        };
        
        const { data: updatedBook, error: updateError } = await supabase
          .from('books')
          .update(updateData)
          .eq('id', book.id)
          .select()
          .single();
        
        if (updateError) {
          console.error('❌ ОШИБКА при обновлении информации о файле:');
          console.error(updateError.message);
          return;
        }
        
        console.log('✅ Информация о файле успешно обновлена:');
        console.log(`  File URL: ${updatedBook.file_url}`);
        console.log(`  File Size: ${updatedBook.file_size}`);
        console.log(`  File Format: ${updatedBook.file_format}`);
        console.log(`  Telegram File ID: ${updatedBook.telegram_file_id}`);
        console.log(`  Storage Path: ${updatedBook.storage_path}`);
        
        console.log('\n🎉 Файл успешно привязан к книге!');
      } else {
        console.error('❌ ОШИБКА: Книга не найдена');
        if (bookError) console.error(bookError.message);
        return;
      }
    } else {
      console.log('ℹ️  Запись в telegram_processed_messages с telegram_file_id не найдена');
      console.log('Проверяем, есть ли запись с message_id...');
      
      // Попробуем найти запись по message_id (из публичного канала метаданных)
      let { data: metadataMessage, error: metadataError } = await supabase
        .from('telegram_processed_messages')
        .select('*')
        .eq('message_id', messageId)
        .single();
      
      if (metadataMessage && !metadataError) {
        console.log('✅ Найдена запись метаданных в telegram_processed_messages:');
        console.log(`  ID: ${metadataMessage.id}`);
        console.log(`  Book ID: ${metadataMessage.book_id}`);
        console.log(`  Message ID: ${metadataMessage.message_id}`);
        
        // Проверяем, есть ли у этой записи уже telegram_file_id
        if (metadataMessage.telegram_file_id) {
          console.log(`⚠️  Для этой записи уже установлен telegram_file_id: ${metadataMessage.telegram_file_id}`);
          console.log('Файл, возможно, уже привязан.');
          return;
        }
        
        // Получаем информацию о книге
        console.log('\n2. Получение информации о книге...');
        let { data: book, error: bookError } = await supabase
          .from('books')
          .select('*')
          .eq('id', metadataMessage.book_id)
          .single();
        
        if (book && !bookError) {
          console.log('✅ Найдена книга:');
          console.log(`  Название: ${book.title}`);
          console.log(`  Автор: ${book.author}`);
          console.log(`  ID: ${book.id}`);
          
          // Обновляем информацию о файле книги
          console.log('\n3. Обновление информации о файле книги...');
          
          const updateData = {
            file_url: `https://s3.cloud.ru/books/${fileName}`,
            file_size: fileSize,
            file_format: 'zip',
            telegram_file_id: messageId, // Это ID файла из приватного канала
            storage_path: `books/${fileName}`
          };
          
          const { data: updatedBook, error: updateError } = await supabase
            .from('books')
            .update(updateData)
            .eq('id', book.id)
            .select()
            .single();
          
          if (updateError) {
            console.error('❌ ОШИБКА при обновлении информации о файле:');
            console.error(updateError.message);
            return;
          }
          
          console.log('✅ Информация о файле успешно обновлена:');
          console.log(`  File URL: ${updatedBook.file_url}`);
          console.log(`  File Size: ${updatedBook.file_size}`);
          console.log(`  File Format: ${updatedBook.file_format}`);
          console.log(`  Telegram File ID: ${updatedBook.telegram_file_id}`);
          console.log(`  Storage Path: ${updatedBook.storage_path}`);
          
          // Обновляем запись в telegram_processed_messages с telegram_file_id
          console.log('\n4. Обновление записи в telegram_processed_messages...');
          const { error: updateMessageError } = await supabase
            .from('telegram_processed_messages')
            .update({
              telegram_file_id: messageId,
              processed_at: new Date().toISOString()
            })
            .eq('id', metadataMessage.id);
          
          if (updateMessageError) {
            console.error('❌ ОШИБКА при обновлении telegram_processed_messages:');
            console.error(updateMessageError.message);
            return;
          }
          
          console.log('✅ Запись в telegram_processed_messages успешно обновлена');
          console.log('\n🎉 Файл успешно привязан к книге!');
        } else {
          console.error('❌ ОШИБКА: Книга не найдена');
          if (bookError) console.error(bookError.message);
          return;
        }
      } else {
        console.log('❌ Запись в telegram_processed_messages не найдена ни по telegram_file_id, ни по message_id');
        console.log('Возможно, книга еще не импортирована из публичного канала метаданных.');
        if (metadataError) console.error(metadataError.message);
        return;
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Запуск привязки
if (require.main === module) {
  correctlyBindFileToBook()
    .then(() => {
      console.log('\n✅ Привязка завершена');
    })
    .catch((error) => {
      console.error('\n❌ Привязка завершена с ошибкой:', error);
      process.exit(1);
    });
}

export { correctlyBindFileToBook };