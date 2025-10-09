import { serverSupabase } from '../lib/serverSupabase';

async function checkTableStructure() {
  try {
    console.log('Checking telegram_messages_index table structure...');
    
    // @ts-ignore
    const { data, error } = await serverSupabase
      .from('telegram_messages_index')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Sample data:', data);
    }
    
    // Try to get table info
    // @ts-ignore
    const { data: tableInfo, error: tableError } = await serverSupabase
      .from('information_schema.columns')
      .select('*')
      .eq('table_name', 'telegram_messages_index');
      
    if (tableError) {
      console.error('Table info error:', tableError);
    } else {
      console.log('Table columns:', tableInfo);
    }
  } catch (error) {
    console.error('Error checking table structure:', error);
  }
}

checkTableStructure();