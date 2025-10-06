/**
 * Симуляция загрузки файлов с лимитом 10
 * Для демонстрации работы системы без реальной интеграции с Telegram
 */
async function simulateDownload(limit: number = 10) {
  console.log(`🚀 Симуляция загрузки файлов (лимит: ${limit})`);
  
  // Симулируем обработку файлов
  const results = [];
  
  for (let i = 1; i <= Math.min(limit, 10); i++) {
    // Симулируем задержку для реалистичности
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const filename = `book_${Math.floor(Math.random() * 10000)}.zip`;
    const success = Math.random() > 0.2; // 80% успеха
    
    results.push({
      messageId: 1000 + i,
      filename,
      success,
      ...(success ? {} : { error: 'Network timeout' })
    });
    
    console.log(`  ${success ? '✅' : '❌'} ${filename} (ID: ${1000 + i}) ${success ? 'загружен' : 'ошибка'}`);
  }
  
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.length - successCount;
  
  console.log(`\n📊 Результаты симуляции:`);
  console.log(`   Всего обработано: ${results.length}`);
  console.log(`   Успешно: ${successCount}`);
  console.log(`   Ошибок: ${failedCount}`);
  
  return {
    success: true,
    message: `Симуляция завершена: ${successCount} из ${results.length} файлов`,
    results,
    actions: [
      `Обработано файлов: ${results.length}`,
      `Успешно: ${successCount}`,
      `С ошибками: ${failedCount}`
    ]
  };
}

// Запуск симуляции с лимитом 10
simulateDownload(10)
  .then(result => {
    console.log('\n✅ Симуляция завершена успешно');
  })
  .catch(error => {
    console.error('❌ Ошибка симуляции:', error);
    process.exit(1);
  });