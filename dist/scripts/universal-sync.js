"use strict";
/**
 * Универсальный скрипт синхронизации данных из Telegram
 *
 * Этот скрипт:
 * 1. Берет одну публикацию из канала Telegram
 * 2. Проверяет наличие этой книги в БД
 * 3. В случае обнаружения книги в БД проверяет на полноту всех метаданных и дополняет их при необходимости
 * 4. Выполняет автоматическую дедупликацию (проверка и удаление дубликатов книг)
 * 5. Проверяет наличие файла с архивом книги и в случае его отсутствия находит файл в приватном канале,
 *    загружает в бакет и добавляет ссылку на файл в БД
 * 6. Выводит краткий отчет о проделанных действиях на русском языке в окно "Результаты последней операции"
 * 7. Заносит в БД данные об обработанной книге, чтобы исключить необходимость повторной работы с ней
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncSinglePublication = syncSinglePublication;
var dotenv_1 = require("dotenv");
var supabase_js_1 = require("@supabase/supabase-js");
var sync_1 = require("../lib/telegram/sync");
// Load environment variables
(0, dotenv_1.config)({ path: '.env.local' });
(0, dotenv_1.config)({ path: '.env' });
// Supabase credentials
var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}
var supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, serviceRoleKey);
/**
 * Проверяет наличие книги в БД по метаданным
 */
function findBookInDatabase(metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, fuzzyMatches, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, supabaseAdmin
                            .from('books')
                            .select('*')
                            .eq('title', metadata.title)
                            .eq('author', metadata.author)
                            .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error && error.code !== 'PGRST116') { // PGRST116 - "single row expected"
                        console.error('Error searching for book:', error);
                        return [2 /*return*/, { exists: false }];
                    }
                    if (data) {
                        return [2 /*return*/, { exists: true, book: data }];
                    }
                    return [4 /*yield*/, supabaseAdmin.rpc('search_books', {
                            search_term: "".concat(metadata.title, " ").concat(metadata.author)
                        }).limit(1)];
                case 2:
                    fuzzyMatches = (_b.sent()).data;
                    if (fuzzyMatches && fuzzyMatches.length > 0) {
                        return [2 /*return*/, { exists: true, book: fuzzyMatches[0] }];
                    }
                    return [2 /*return*/, { exists: false }];
                case 3:
                    error_1 = _b.sent();
                    console.error('Error in findBookInDatabase:', error_1);
                    return [2 /*return*/, { exists: false }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Дополняет метаданные книги
 */
function enrichBookMetadata(bookId, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var updateData, year, error, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    updateData = {};
                    year = metadata.books && metadata.books.length > 0 ? metadata.books[0].year : undefined;
                    if (year && !isNaN(year)) {
                        updateData.publication_year = year;
                    }
                    if (metadata.description) {
                        updateData.description = metadata.description;
                    }
                    if (metadata.coverUrls && metadata.coverUrls.length > 0) {
                        // Используем первую обложку как основную
                        updateData.cover_url = metadata.coverUrls[0];
                        // Примечание: поле cover_urls может отсутствовать в схеме БД
                        // updateData.cover_urls = metadata.coverUrls;
                    }
                    if (!(Object.keys(updateData).length > 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, supabaseAdmin
                            .from('books')
                            .update(updateData)
                            .eq('id', bookId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        console.error('Error enriching book metadata:', error);
                    }
                    else {
                        console.log("\u2705 \u041C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u0435 \u043A\u043D\u0438\u0433\u0438 ".concat(bookId, " \u043E\u0431\u043E\u0433\u0430\u0449\u0435\u043D\u044B"));
                    }
                    _a.label = 2;
                case 2: return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error in enrichBookMetadata:', error_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Проверяет и удаляет дубликаты книг
 */
function performDeduplication(bookId, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, duplicates, error, bookToKeep, booksToDelete, _i, booksToDelete_1, duplicate, updateError, duplicateIds, deleteError, error_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 7, , 8]);
                    console.log('🔍 Проверка дубликатов...');
                    return [4 /*yield*/, supabaseAdmin
                            .from('books')
                            .select('id, title, author, file_url, created_at')
                            .eq('title', metadata.title)
                            .eq('author', metadata.author)];
                case 1:
                    _a = _b.sent(), duplicates = _a.data, error = _a.error;
                    if (error) {
                        console.error('Error finding duplicates:', error);
                        return [2 /*return*/, false];
                    }
                    if (!duplicates || duplicates.length <= 1) {
                        console.log('✅ Дубликаты не найдены');
                        return [2 /*return*/, true];
                    }
                    // Сортируем по дате создания (новые первыми)
                    duplicates.sort(function (a, b) { return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); });
                    bookToKeep = duplicates[0];
                    booksToDelete = duplicates.slice(1);
                    console.log("\u26A0\uFE0F  \u041D\u0430\u0439\u0434\u0435\u043D\u043E ".concat(duplicates.length, " \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u043E\u0432. \u041E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u043C: ").concat(bookToKeep.id));
                    _i = 0, booksToDelete_1 = booksToDelete;
                    _b.label = 2;
                case 2:
                    if (!(_i < booksToDelete_1.length)) return [3 /*break*/, 5];
                    duplicate = booksToDelete_1[_i];
                    if (!(duplicate.file_url && !bookToKeep.file_url && duplicate.id === bookId)) return [3 /*break*/, 4];
                    console.log("\uD83D\uDD04 \u041F\u0435\u0440\u0435\u043D\u043E\u0441 \u0444\u0430\u0439\u043B\u0430 \u0438\u0437 \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u0430 ".concat(duplicate.id, " \u0432 \u043E\u0441\u043D\u043E\u0432\u043D\u0443\u044E \u0437\u0430\u043F\u0438\u0441\u044C ").concat(bookToKeep.id));
                    return [4 /*yield*/, supabaseAdmin
                            .from('books')
                            .update({
                            file_url: duplicate.file_url,
                            // Эти поля не запрашиваются в select, поэтому их нельзя использовать
                            // file_size: duplicate.file_size,
                            // file_format: duplicate.file_format,
                            // telegram_file_id: duplicate.telegram_file_id,
                            // storage_path: duplicate.storage_path,
                            updated_at: new Date().toISOString()
                        })
                            .eq('id', bookToKeep.id)];
                case 3:
                    updateError = (_b.sent()).error;
                    if (updateError) {
                        console.error('Error transferring file to main book:', updateError);
                    }
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    duplicateIds = booksToDelete.map(function (b) { return b.id; });
                    return [4 /*yield*/, supabaseAdmin
                            .from('books')
                            .delete()
                            .in('id', duplicateIds)];
                case 6:
                    deleteError = (_b.sent()).error;
                    if (deleteError) {
                        console.error('Error deleting duplicates:', deleteError);
                        return [2 /*return*/, false];
                    }
                    console.log("\u2705 \u0423\u0434\u0430\u043B\u0435\u043D\u043E ".concat(duplicateIds.length, " \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u043E\u0432"));
                    return [2 /*return*/, true];
                case 7:
                    error_3 = _b.sent();
                    console.error('Error in performDeduplication:', error_3);
                    return [2 /*return*/, false];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Проверяет наличие файла книги и при необходимости загружает его
 */
function ensureBookFile(bookId, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, book, bookError, syncService_1, downloadError_1, syncService, archiveResults, searchTitle, searchAuthor, foundFile, _i, archiveResults_1, result, filename, updateError, processError_1, error_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 16, , 17]);
                    return [4 /*yield*/, supabaseAdmin
                            .from('books')
                            .select('file_url, telegram_file_id, title, author')
                            .eq('id', bookId)
                            .single()];
                case 1:
                    _a = _b.sent(), book = _a.data, bookError = _a.error;
                    if (bookError) {
                        console.error('Error fetching book:', bookError);
                        return [2 /*return*/, false];
                    }
                    // Если файл уже есть, пропускаем
                    if (book.file_url) {
                        console.log('✅ Файл книги уже существует');
                        return [2 /*return*/, true];
                    }
                    if (!book.telegram_file_id) return [3 /*break*/, 6];
                    console.log("\uD83D\uDCE5 \u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0444\u0430\u0439\u043B\u0430 \u0438\u0437 Telegram (ID: ".concat(book.telegram_file_id, ")..."));
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, sync_1.TelegramSyncService.getInstance()];
                case 3:
                    syncService_1 = _b.sent();
                    return [4 /*yield*/, syncService_1.downloadBook(parseInt(book.telegram_file_id))];
                case 4:
                    _b.sent();
                    console.log('✅ Файл успешно загружен и привязан к книге');
                    return [2 /*return*/, true];
                case 5:
                    downloadError_1 = _b.sent();
                    console.error('Error downloading book file:', downloadError_1);
                    return [3 /*break*/, 6];
                case 6:
                    // Если файла нет и не можем загрузить по telegram_file_id,
                    // ищем в канале архива
                    console.log('🔍 Поиск файла в канале архива...');
                    return [4 /*yield*/, sync_1.TelegramSyncService.getInstance()];
                case 7:
                    syncService = _b.sent();
                    return [4 /*yield*/, syncService.downloadAndProcessFilesDirectly(30)];
                case 8:
                    archiveResults = _b.sent();
                    searchTitle = book.title.toLowerCase();
                    searchAuthor = book.author.toLowerCase();
                    console.log("\uD83D\uDD0E \u041F\u043E\u0438\u0441\u043A \u0444\u0430\u0439\u043B\u0430 \u0434\u043B\u044F: ".concat(book.author, " - ").concat(book.title));
                    foundFile = false;
                    _i = 0, archiveResults_1 = archiveResults;
                    _b.label = 9;
                case 9:
                    if (!(_i < archiveResults_1.length)) return [3 /*break*/, 15];
                    result = archiveResults_1[_i];
                    if (!(result.success && result.filename)) return [3 /*break*/, 14];
                    filename = result.filename.toLowerCase();
                    if (!(filename.includes(searchAuthor.replace(/\s+/g, '_')) &&
                        filename.includes(searchTitle.replace(/\s+/g, '_')))) return [3 /*break*/, 14];
                    console.log("\uD83C\uDFAF \u041D\u0430\u0439\u0434\u0435\u043D \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0439 \u0444\u0430\u0439\u043B: ".concat(result.filename));
                    _b.label = 10;
                case 10:
                    _b.trys.push([10, 13, , 14]);
                    if (!result.messageId) return [3 /*break*/, 12];
                    return [4 /*yield*/, supabaseAdmin
                            .from('telegram_download_queue')
                            .update({
                            status: 'completed',
                            completed_at: new Date().toISOString()
                        })
                            .eq('message_id', result.messageId)];
                case 11:
                    updateError = (_b.sent()).error;
                    if (updateError) {
                        console.warn('Error updating download queue:', updateError);
                    }
                    _b.label = 12;
                case 12:
                    console.log('✅ Файл успешно привязан к книге');
                    foundFile = true;
                    return [3 /*break*/, 15];
                case 13:
                    processError_1 = _b.sent();
                    console.error('Error processing found file:', processError_1);
                    return [3 /*break*/, 14];
                case 14:
                    _i++;
                    return [3 /*break*/, 9];
                case 15:
                    if (!foundFile) {
                        console.log("\uD83D\uDCC1 \u041F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0439 \u0444\u0430\u0439\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0430\u0440\u0445\u0438\u0432\u0435 (".concat(archiveResults.length, " \u0444\u0430\u0439\u043B\u043E\u0432 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E)"));
                        return [2 /*return*/, false];
                    }
                    return [2 /*return*/, true];
                case 16:
                    error_4 = _b.sent();
                    console.error('Error in ensureBookFile:', error_4);
                    return [2 /*return*/, false];
                case 17: return [2 /*return*/];
            }
        });
    });
}
/**
 * Отмечает книгу как обработанную
 */
function markBookAsProcessed(bookId) {
    return __awaiter(this, void 0, void 0, function () {
        var error, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, supabaseAdmin
                            .from('books')
                            .update({
                            updated_at: new Date().toISOString(),
                            // Можно добавить специальное поле, если нужно отслеживать обработку
                            // processed_at: new Date().toISOString()
                        })
                            .eq('id', bookId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        console.error('Error marking book as processed:', error);
                    }
                    else {
                        console.log("\u2705 \u041A\u043D\u0438\u0433\u0430 ".concat(bookId, " \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u0430 \u043A\u0430\u043A \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043D\u0430\u044F"));
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_5 = _a.sent();
                    console.error('Error in markBookAsProcessed:', error_5);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Основная функция синхронизации
 */
function syncSinglePublication() {
    return __awaiter(this, void 0, void 0, function () {
        var actions, bookId, syncService, metadataList, metadata, bookCheck, _a, data, error, dedupResult, fileResult, error_6, syncService, shutdownError_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    actions = [];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 16, 17, 22]);
                    console.log('🚀 Начало синхронизации одной публикации из Telegram...');
                    actions.push('Начало синхронизации');
                    return [4 /*yield*/, sync_1.TelegramSyncService.getInstance()];
                case 2:
                    syncService = _c.sent();
                    return [4 /*yield*/, syncService.syncMetadata(1)];
                case 3:
                    metadataList = _c.sent();
                    if (!metadataList || metadataList.length === 0) {
                        return [2 /*return*/, {
                                success: false,
                                message: 'Не найдено публикаций в Telegram канале',
                                actions: __spreadArray(__spreadArray([], actions, true), ['Нет публикаций для обработки'], false)
                            }];
                    }
                    metadata = metadataList[0];
                    console.log("\uD83D\uDCDA \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u044B \u043C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u0435: \"".concat(metadata.title, "\" \u0430\u0432\u0442\u043E\u0440\u0430 ").concat(metadata.author));
                    actions.push("\u041F\u043E\u043B\u0443\u0447\u0435\u043D\u044B \u043C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u0435 \u043A\u043D\u0438\u0433\u0438: \"".concat(metadata.title, "\""));
                    return [4 /*yield*/, findBookInDatabase(metadata)];
                case 4:
                    bookCheck = _c.sent();
                    if (!(bookCheck.exists && bookCheck.book)) return [3 /*break*/, 5];
                    bookId = bookCheck.book.id;
                    console.log("\u2705 \u041A\u043D\u0438\u0433\u0430 \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 \u0411\u0414 (ID: ".concat(bookId, ")"));
                    actions.push("\u041A\u043D\u0438\u0433\u0430 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 \u0411\u0414 (ID: ".concat(bookId, ")"));
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, supabaseAdmin
                        .from('books')
                        .insert({
                        title: metadata.title,
                        author: metadata.author,
                        publication_year: metadata.books && metadata.books.length > 0 ? metadata.books[0].year : undefined,
                        description: metadata.description,
                        cover_url: ((_b = metadata.coverUrls) === null || _b === void 0 ? void 0 : _b[0]) || null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                        .select()
                        .single()];
                case 6:
                    _a = _c.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        throw new Error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0437\u0430\u043F\u0438\u0441\u0438 \u043A\u043D\u0438\u0433\u0438: ".concat(error.message));
                    }
                    bookId = data.id;
                    console.log("\uD83C\uDD95 \u0421\u043E\u0437\u0434\u0430\u043D\u0430 \u043D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u043A\u043D\u0438\u0433\u0438 (ID: ".concat(bookId, ")"));
                    actions.push("\u0421\u043E\u0437\u0434\u0430\u043D\u0430 \u043D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u043A\u043D\u0438\u0433\u0438 (ID: ".concat(bookId, ")"));
                    _c.label = 7;
                case 7:
                    if (!bookId) return [3 /*break*/, 9];
                    return [4 /*yield*/, enrichBookMetadata(bookId, metadata)];
                case 8:
                    _c.sent();
                    actions.push('Метаданные проверены и дополнены при необходимости');
                    return [3 /*break*/, 10];
                case 9:
                    actions.push('Ошибка: не удалось получить ID книги для обогащения метаданных');
                    _c.label = 10;
                case 10:
                    if (!bookId) return [3 /*break*/, 14];
                    return [4 /*yield*/, performDeduplication(bookId, metadata)];
                case 11:
                    dedupResult = _c.sent();
                    if (dedupResult) {
                        actions.push('Выполнена проверка и удаление дубликатов');
                    }
                    else {
                        actions.push('Ошибка при выполнении дедупликации');
                    }
                    return [4 /*yield*/, ensureBookFile(bookId, metadata)];
                case 12:
                    fileResult = _c.sent();
                    if (fileResult) {
                        actions.push('Файл книги проверен и загружен при необходимости');
                    }
                    else {
                        actions.push('Файл книги отсутствует, требуется ручная обработка');
                    }
                    // 6. Отмечаем книгу как обработанную
                    return [4 /*yield*/, markBookAsProcessed(bookId)];
                case 13:
                    // 6. Отмечаем книгу как обработанную
                    _c.sent();
                    actions.push('Книга отмечена как обработанная');
                    return [3 /*break*/, 15];
                case 14:
                    actions.push('Ошибка: не удалось получить ID книги');
                    _c.label = 15;
                case 15:
                    console.log('✅ Синхронизация успешно завершена');
                    return [2 /*return*/, {
                            success: true,
                            message: 'Синхронизация успешно завершена',
                            bookId: bookId,
                            actions: actions
                        }];
                case 16:
                    error_6 = _c.sent();
                    console.error('❌ Ошибка синхронизации:', error_6);
                    actions.push("\u041E\u0448\u0438\u0431\u043A\u0430: ".concat(error_6 instanceof Error ? error_6.message : 'Неизвестная ошибка'));
                    return [2 /*return*/, {
                            success: false,
                            message: error_6 instanceof Error ? error_6.message : 'Неизвестная ошибка',
                            bookId: bookId,
                            actions: actions
                        }];
                case 17:
                    _c.trys.push([17, 20, , 21]);
                    return [4 /*yield*/, sync_1.TelegramSyncService.getInstance()];
                case 18:
                    syncService = _c.sent();
                    return [4 /*yield*/, syncService.shutdown()];
                case 19:
                    _c.sent();
                    return [3 /*break*/, 21];
                case 20:
                    shutdownError_1 = _c.sent();
                    console.error('Error during shutdown:', shutdownError_1);
                    return [3 /*break*/, 21];
                case 21: return [7 /*endfinally*/];
                case 22: return [2 /*return*/];
            }
        });
    });
}
// Если скрипт запущен напрямую
if (require.main === module) {
    syncSinglePublication()
        .then(function (result) {
        console.log('\n📋 РЕЗУЛЬТАТЫ ПОСЛЕДНЕЙ ОПЕРАЦИИ:');
        console.log('================================');
        console.log("\u0421\u0442\u0430\u0442\u0443\u0441: ".concat(result.success ? 'УСПЕШНО' : 'ОШИБКА'));
        console.log("\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435: ".concat(result.message));
        if (result.bookId) {
            console.log("ID \u043A\u043D\u0438\u0433\u0438: ".concat(result.bookId));
        }
        console.log('\nВыполненные действия:');
        result.actions.forEach(function (action, index) {
            console.log("".concat(index + 1, ". ").concat(action));
        });
        console.log('================================');
        process.exit(result.success ? 0 : 1);
    })
        .catch(function (error) {
        console.error('.Fatal error:', error);
        process.exit(1);
    });
}
