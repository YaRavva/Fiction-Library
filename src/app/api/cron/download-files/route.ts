import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '@/lib/telegram/sync';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Anti-spam protection: minimum interval between runs (in milliseconds)
const MIN_INTERVAL_BETWEEN_RUNS = 5 * 60 * 1000; // 5 minutes

// Rate limiting: maximum number of files to process per run
const MAX_FILES_PER_RUN = 20;

/**
 * GET /api/cron/download-files
 * Runs the file download process via cron with anti-spam protection
 */
export async function GET(request: NextRequest) {
  // Check for cron auth token if provided
  const authToken = process.env.CRON_AUTH_TOKEN;
  if (authToken) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${authToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  let syncService: TelegramSyncService | null = null;
  
  try {
    console.log('🔍 Starting cron file download process...');
    
    // Check if the file download process is enabled
    const { data: timerSettings, error: timerError } = await supabaseAdmin
      .from('timer_settings')
      .select('enabled, interval_minutes, last_run')
      .eq('process_name', 'file_download')
      .single();

    if (timerError) {
      console.error('Could not fetch timer settings:', timerError);
      return NextResponse.json(
        { error: 'Could not fetch timer settings' },
        { status: 500 }
      );
    }

    // If the process is disabled, skip execution
    if (!timerSettings.enabled) {
      console.log('⏭️  File download process is disabled, skipping execution');
      return NextResponse.json({
        message: 'File download process is disabled',
        enabled: timerSettings.enabled
      });
    }

    // Anti-spam protection: Check when the last run was
    if (timerSettings.last_run) {
      const lastRun = new Date(timerSettings.last_run).getTime();
      const now = Date.now();
      const timeSinceLastRun = now - lastRun;
      
      if (timeSinceLastRun < MIN_INTERVAL_BETWEEN_RUNS) {
        console.log(`⚠️  Skipping download due to anti-spam protection. Last run was ${Math.floor(timeSinceLastRun / 1000)} seconds ago`);
        return NextResponse.json({
          message: 'Skipped due to anti-spam protection',
          timeSinceLastRun: timeSinceLastRun,
          minInterval: MIN_INTERVAL_BETWEEN_RUNS
        });
      }
    }

    // Initialize Telegram sync service
    syncService = await TelegramSyncService.getInstance();
    
    // Run file download with rate limiting
    console.log(`📚 Starting file download process (max ${MAX_FILES_PER_RUN} files)`);
    const results = await syncService.downloadAndProcessFilesDirectly(MAX_FILES_PER_RUN);
    
    console.log(`✅ Cron file download completed. Processed ${results.length} files`);
    
    // Update timer settings with last run time
    const now = new Date().toISOString();
    const intervalMinutes = timerSettings.interval_minutes || 15;
    const nextRun = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
    
    await supabaseAdmin
      .from('timer_settings')
      .update({
        last_run: now,
        next_run: nextRun,
        updated_at: now,
      })
      .eq('process_name', 'file_download');
      
    console.log(`⏰ Timer settings updated for file_download process`);
    
    // Shutdown the Telegram client to prevent hanging
    try {
      await syncService.shutdown();
      console.log('🔌 Telegram client disconnected');
    } catch (shutdownError) {
      console.warn('⚠️  Error during Telegram client shutdown:', shutdownError);
    }
    
    return NextResponse.json({
      message: 'File download process completed',
      filesProcessed: results.length,
      files: results,
    });
  } catch (error) {
    console.error('❌ Error during cron file download:', error);
    
    // Try to shutdown the Telegram client even in case of error
    if (syncService) {
      try {
        await syncService.shutdown();
        console.log('🔌 Telegram client disconnected after error');
      } catch (shutdownError) {
        console.warn('⚠️  Error during Telegram client shutdown after main error:', shutdownError);
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}