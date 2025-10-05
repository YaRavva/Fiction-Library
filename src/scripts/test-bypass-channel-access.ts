/**
 * Test script to bypass channel access issues and test file processing
 * This script simulates the file processing workflow using existing logic
 */

import { config } from 'dotenv';

// Load environment variables FIRST
config({ path: '.env' });

async function testBypassChannelAccess() {
  console.log('🚀 Testing file processing workflow (bypassing channel access)...\n');
  
  try {
    // Dynamically import TelegramSyncService after dotenv is loaded
    const { TelegramSyncService } = await import('../lib/telegram/sync');
    
    // Test the metadata extraction logic
    console.log('🧪 Testing metadata extraction from filenames...\n');
    
    const testFilenames = [
      "Владимир Савченко - Вселяне.fb2",
      "Йен Макдональд - Индия.zip",
      "Елизавета Дворецкая - Корабль во фьорде.epub",
      "Андрей Валерьев - Форпост.rar",
      "Марко Клоос - Линия фронта.pdf",
      "Саба Тахир - Уголёк в пепле.mobi",
      "Маркус Сэйки - Одаренные.epub"
    ];
    
    for (const filename of testFilenames) {
      const { author, title } = TelegramSyncService.extractMetadataFromFilename(filename);
      console.log(`📁 ${filename}`);
      console.log(`   Author: ${author}`);
      console.log(`   Title: ${title}`);
      console.log('');
    }
    
    console.log('✅ Metadata extraction test completed!');
    
    // Test the file matching logic
    console.log('\n🔍 Testing file matching logic...\n');
    
    // Simulate some book records
    const mockBooks = [
      { id: '1', title: 'цикл Вселяне', author: 'Владимир Савченко' },
      { id: '2', title: 'цикл Индия', author: 'Йен Макдональд' },
      { id: '3', title: 'цикл Корабль во фьорде', author: 'Елизавета Дворецкая' },
      { id: '4', title: 'цикл Форпост', author: 'Андрей Валерьев' },
      { id: '5', title: 'Сроки службы', author: 'Марко Клоос' }
    ];
    
    console.log('📚 Mock books in database:');
    mockBooks.forEach(book => {
      console.log(`   "${book.title}" by ${book.author}`);
    });
    
    console.log('\n📊 Matching results:');
    
    for (const filename of testFilenames) {
      const { author, title } = TelegramSyncService.extractMetadataFromFilename(filename);
      console.log(`\n📁 ${filename}`);
      console.log(`   Extracted: "${title}" by ${author}`);
      
      // Try to find matching book
      const matches = mockBooks.filter(book => {
        const titleMatch = book.title.toLowerCase().includes(title.toLowerCase()) || 
                          title.toLowerCase().includes(book.title.toLowerCase());
        const authorMatch = book.author.toLowerCase().includes(author.toLowerCase()) || 
                           author.toLowerCase().includes(book.author.toLowerCase());
        return titleMatch || authorMatch;
      });
      
      if (matches.length > 0) {
        console.log(`   ✅ Found ${matches.length} matches:`);
        matches.forEach(match => {
          console.log(`      "${match.title}" by ${match.author}`);
        });
      } else {
        console.log(`   ❌ No matches found`);
      }
    }
    
    console.log('\n✅ File matching test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the script
testBypassChannelAccess().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});