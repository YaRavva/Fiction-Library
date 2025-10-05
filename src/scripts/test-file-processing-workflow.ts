/**
 * Final test script demonstrating the complete file processing workflow
 * This script shows the full process of accessing files, matching with books, and preparing for download
 */

import { config } from 'dotenv';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import bigInt from 'big-integer';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env' });

async function testFileProcessingWorkflow() {
  console.log('🚀 Testing complete file processing workflow...\n');
  
  let client: TelegramClient | null = null;
  
  try {
    // Get environment variables
    const apiId = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!apiId || !apiHash || !sessionString || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing required environment variables');
    }
    
    // Initialize Telegram client
    console.log('🔧 Initializing Telegram client...');
    const session = new StringSession(sessionString);
    client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await client.connect();
    console.log('✅ Telegram client connected\n');
    
    // Create Supabase client
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Access the files channel
    const channelId = 1515159552;
    console.log(`🆔 Accessing channel: Архив для фантастики (ID: ${channelId})\n`);
    
    // Get channel entity
    const channelEntity = await client.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
    console.log(`✅ Channel entity obtained: ${(channelEntity as any).title}\n`);
    
    // Get messages from the channel
    console.log('📥 Getting files from channel...');
    const messages = await client.getMessages(channelEntity, { limit: 15 });
    console.log(`📊 Found ${messages.length} messages\n`);
    
    // Extract file information
    console.log('📁 Files found in channel:');
    const files: any[] = [];
    
    for (const msg of messages) {
      if ((msg as any).media && (msg as any).media.className === 'MessageMediaDocument') {
        const document = (msg as any).media.document;
        if (document) {
          const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
          const filename = filenameAttr?.fileName || `book_${msg.id}`;
          
          const file = {
            id: msg.id,
            filename: filename,
            size: document.size,
            mimeType: document.mimeType,
            message: msg
          };
          
          files.push(file);
          console.log(`  ${files.length}. ${filename} (${document.size} bytes)`);
          
          if (files.length >= 10) break; // Limit to first 10 files
        }
      }
    }
    
    console.log(`\n✅ Found ${files.length} files in channel\n`);
    
    if (files.length === 0) {
      console.log('❌ No files found in channel');
      return;
    }
    
    // Fetch books from database for matching
    console.log('📖 Fetching books from database for matching...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, file_url, telegram_file_id')
      .limit(50);
    
    if (booksError) {
      throw new Error(`Error fetching books: ${booksError.message}`);
    }
    
    console.log(`✅ Retrieved ${books?.length || 0} books from database\n`);
    
    // Process files and match with books
    console.log('🔍 Matching files with books...\n');
    
    // Dynamically import TelegramSyncService for metadata extraction
    const { TelegramSyncService } = await import('../lib/telegram/sync');
    
    let matchCount = 0;
    let filesWithAttachments = 0;
    
    for (const file of files) {
      console.log(`📁 Processing file: ${file.filename}`);
      
      // Extract metadata from filename
      const { author, title } = TelegramSyncService.extractMetadataFromFilename(file.filename);
      console.log(`   Extracted - Author: "${author}", Title: "${title}"`);
      
      // Find matching book
      let bestMatch: any | null = null;
      let bestScore = 0;
      
      for (const book of books || []) {
        const bookTitle = book.title || '';
        const bookAuthor = book.author || '';
        
        // Calculate similarity scores
        let score = 0;
        
        // Author matching
        if (author.toLowerCase().includes(bookAuthor.toLowerCase()) || 
            bookAuthor.toLowerCase().includes(author.toLowerCase())) {
          score += 2;
        }
        
        // Title matching
        if (title.toLowerCase().includes(bookTitle.toLowerCase()) || 
            bookTitle.toLowerCase().includes(title.toLowerCase())) {
          score += 2;
        }
        
        // Special handling for series
        if (bookTitle.includes('цикл') && title.includes(bookTitle.replace('цикл ', ''))) {
          score += 1;
        }
        
        if (score > bestScore && score >= 2) {
          bestScore = score;
          bestMatch = book;
        }
      }
      
      if (bestMatch) {
        console.log(`   ✅ Match found: "${bestMatch.title}" by ${bestMatch.author} (score: ${bestScore})`);
        matchCount++;
        
        // Check if book already has a file
        if (bestMatch.file_url && bestMatch.file_url.length > 0) {
          console.log(`   📎 Book already has file attached`);
          filesWithAttachments++;
        } else {
          console.log(`   📭 Book needs file attachment`);
        }
      } else {
        console.log(`   ❌ No good match found`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log('📊 SUMMARY:');
    console.log(`   Files processed: ${files.length}`);
    console.log(`   Files with matches: ${matchCount}`);
    console.log(`   Files with existing attachments: ${filesWithAttachments}`);
    console.log(`   Files needing attachment: ${matchCount - filesWithAttachments}`);
    
    if (matchCount > 0) {
      console.log('\n🎉 SUCCESS: File processing workflow is working correctly!');
      console.log('💡 Next steps:');
      console.log('   1. Download matched files from Telegram');
      console.log('   2. Upload files to Supabase storage');
      console.log('   3. Update book records with file information');
      console.log('   4. Process remaining unmatched files');
    }
    
    console.log('\n✅ Complete file processing workflow test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Disconnect client
    if (client) {
      try {
        await client.disconnect();
        console.log('\n🧹 Telegram client disconnected');
      } catch (disconnectError) {
        console.error('⚠️ Error disconnecting client:', disconnectError);
      }
    }
    
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the script
testFileProcessingWorkflow().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});