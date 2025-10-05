"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sync_missing_covers_1 = require("./sync-missing-covers");
// Тестируем синхронизацию обложек для 5 книг
(0, sync_missing_covers_1.syncMissingCovers)(5)
    .then(function (result) {
    console.log('Результат синхронизации обложек:', result);
    process.exit(0);
})
    .catch(function (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
    process.exit(1);
});
