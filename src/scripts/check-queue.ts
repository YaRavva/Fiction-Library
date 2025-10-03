import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ygqyswivvdtpgpnxrpzl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncXlzd2l2dmR0cGdwbnhycHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Njg2NzQsImV4cCI6MjA3NDQ0NDY3NH0.lx5zcDdhxrnvcRKyRihyFzq3UO3coPb7vy29JJaBeaw'
);

async function checkQueue() {
  const { data, error } = await supabase.from('telegram_download_queue').select('*');
  
  if (error) {
    console.error('Error fetching queue:', error);
    return;
  }
  
  console.log('Tasks in queue:', data?.length || 0);
  if (data) {
    data.forEach(task => {
      console.log(`Task ${task.id}: message_id=${task.message_id}, status=${task.status}`);
    });
  }
}

checkQueue();