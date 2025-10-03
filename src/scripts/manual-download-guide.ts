/**
 * Script to generate manual download commands for each book
 */

import { config } from 'dotenv';

// Load environment variables FIRST
config({ path: '.env' });

// Define the book-file mappings we found
const BOOK_FILE_MAPPINGS = [
  {
    bookTitle: "цикл Эвернесс",
    bookAuthor: "Йен Макдональд",
    fileId: 2908,
    filename: "Йен Макдональд - Эвернесс.zip"
  },
  {
    bookTitle: "цикл Индия",
    bookAuthor: "Йен Макдональд",
    fileId: 2909,
    filename: "Йен Макдональд - Индия.zip"
  },
  {
    bookTitle: "цикл Луна",
    bookAuthor: "Йен Макдональд",
    fileId: 2907,
    filename: "Йен Макдональд - Луна.zip"
  },
  {
    bookTitle: "цикл Уголёк в пепле",
    bookAuthor: "Саба Тахир",
    fileId: 2906,
    filename: "Саба Тахир - Уголек в пепле.zip"
  },
  {
    bookTitle: "цикл Линия фронта",
    bookAuthor: "Марко Клоос",
    fileId: 2904,
    filename: "Марко_Клоос_Линия_фронта_Сроки_службы.fb2"
  }
];

function generateManualGuide() {
  console.log('📚 MANUAL DOWNLOAD GUIDE');
  console.log('========================\n');
  
  console.log('Due to Telegram rate limiting, it\'s recommended to download books manually with long pauses between each operation.\n');
  
  console.log('Steps to follow for each book:\n');
  
  BOOK_FILE_MAPPINGS.forEach((mapping, index) => {
    console.log(`${index + 1}. Download "${mapping.bookTitle}" by ${mapping.bookAuthor}`);
    console.log(`   File: ${mapping.filename} (Message ID: ${mapping.fileId})`);
    console.log(`   Command: npx tsx src/scripts/download-one-book.ts "${mapping.bookTitle}" "${mapping.bookAuthor}"`);
    console.log(`   Recommendation: Wait at least 2-3 minutes before running the next command\n`);
  });
  
  console.log('💡 TIPS:');
  console.log('- Run one command at a time');
  console.log('- Wait 2-3 minutes between each command to avoid rate limiting');
  console.log('- If you get a flood wait error, wait the specified time plus an additional minute');
  console.log('- You can check progress with: npx tsx src/scripts/check-book-status.ts\n');
}

generateManualGuide();