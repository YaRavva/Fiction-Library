import { downloadMissingFiles } from './download-files';

async function main() {
  const limit = 10;
  console.log(`🚀 Запуск загрузки файлов с лимитом: ${limit}`);
  
  try {
    const result = await downloadMissingFiles(limit);
    console.log(result.report);
  } catch (error) {
    console.error('❌ Ошибка при запуске загрузки файлов:', error);
    process.exit(1);
  }
}

main();