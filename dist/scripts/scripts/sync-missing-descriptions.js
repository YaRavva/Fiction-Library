"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncMissingDescriptions = syncMissingDescriptions;
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var sync_1 = require("../lib/telegram/sync");
var supabase_1 = require("../lib/supabase");
var parser_1 = require("../lib/telegram/parser");
// Загружаем переменные окружения из .env файла
var envPath = (0, path_1.resolve)(__dirname, '../../.env');
(0, dotenv_1.config)({ path: envPath });
/**
 * Синхронизирует описания для книг, у которых они отсутствуют
 * @param limit Количество книг для обработки
 * @returns Результат синхронизации
 */
function syncMissingDescriptions() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var supabase, _a, booksWithoutDescriptions, fetchError, syncService, processed, updated, skipped, errors, _i, booksWithoutDescriptions_1, book, typedBook, channel, channelId, messages, msg, anyMsg, metadata, updateData, updateError, error_1, typedBook, error_2;
        if (limit === void 0) { limit = 50; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 11, , 12]);
                    console.log("\uD83D\uDE80 \u0417\u0430\u043F\u0443\u0441\u043A \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0439 \u0434\u043B\u044F \u043A\u043D\u0438\u0433 \u0431\u0435\u0437 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0439 (\u043B\u0438\u043C\u0438\u0442: ".concat(limit, ")"));
                    // Получаем книги с пустыми описаниями
                    console.log('🔍 Получаем книги с пустыми описаниями...');
                    supabase = (0, supabase_1.getSupabaseAdmin)();
                    if (!supabase) {
                        throw new Error('Не удалось создать клиент Supabase');
                    }
                    return [4 /*yield*/, supabase
                            .from('books')
                            .select('*')
                            .eq('description', '')
                            .limit(limit)];
                case 1:
                    _a = _b.sent(), booksWithoutDescriptions = _a.data, fetchError = _a.error;
                    if (fetchError) {
                        throw new Error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F \u043A\u043D\u0438\u0433 \u0431\u0435\u0437 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0439: ".concat(fetchError.message));
                    }
                    if (!booksWithoutDescriptions || booksWithoutDescriptions.length === 0) {
                        console.log('✅ Нет книг с пустыми описаниями');
                        return [2 /*return*/, {
                                success: true,
                                message: 'Нет книг с пустыми описаниями',
                                processed: 0,
                                updated: 0,
                                skipped: 0,
                                errors: 0
                            }];
                    }
                    console.log("\uD83D\uDCCA \u041D\u0430\u0439\u0434\u0435\u043D\u043E ".concat(booksWithoutDescriptions.length, " \u043A\u043D\u0438\u0433 \u0441 \u043F\u0443\u0441\u0442\u044B\u043C\u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F\u043C\u0438"));
                    return [4 /*yield*/, sync_1.TelegramSyncService.getInstance()];
                case 2:
                    syncService = _b.sent();
                    processed = 0;
                    updated = 0;
                    skipped = 0;
                    errors = 0;
                    _i = 0, booksWithoutDescriptions_1 = booksWithoutDescriptions;
                    _b.label = 3;
                case 3:
                    if (!(_i < booksWithoutDescriptions_1.length)) return [3 /*break*/, 10];
                    book = booksWithoutDescriptions_1[_i];
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 8, , 9]);
                    typedBook = book;
                    console.log("\uD83D\uDCDD \u041E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C \u043A\u043D\u0438\u0433\u0443: ".concat(typedBook.author, " - ").concat(typedBook.title));
                    // Проверяем, есть ли у книги telegram_file_id
                    if (!typedBook.telegram_file_id) {
                        console.log("  \u2139\uFE0F \u0423 \u043A\u043D\u0438\u0433\u0438 \u043D\u0435\u0442 telegram_file_id, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C");
                        skipped++;
                        return [3 /*break*/, 9];
                    }
                    // Получаем сообщение из Telegram по ID
                    console.log("  \uD83D\uDCE5 \u041F\u043E\u043B\u0443\u0447\u0430\u0435\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(typedBook.telegram_file_id, " \u0438\u0437 Telegram..."));
                    return [4 /*yield*/, syncService.telegramClient.getMetadataChannel()];
                case 5:
                    channel = _b.sent();
                    if (!channel) {
                        throw new Error('Не удалось получить канал');
                    }
                    channelId = typeof channel.id === 'object' && channel.id !== null ?
                        channel.id.toString() :
                        String(channel.id);
                    return [4 /*yield*/, syncService.telegramClient.getMessages(channelId, 1, parseInt(typedBook.telegram_file_id))];
                case 6:
                    messages = _b.sent();
                    if (!messages || messages.length === 0) {
                        console.log("  \u2139\uFE0F \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C");
                        skipped++;
                        return [3 /*break*/, 9];
                    }
                    msg = messages[0];
                    anyMsg = msg;
                    // Проверяем наличие текста в сообщении
                    if (!anyMsg.message) {
                        console.log("  \u2139\uFE0F \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442\u0430, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C");
                        skipped++;
                        return [3 /*break*/, 9];
                    }
                    // Парсим текст сообщения для извлечения описания
                    console.log("  \uD83D\uDCC4 \u041F\u0430\u0440\u0441\u0438\u043C \u0442\u0435\u043A\u0441\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0434\u043B\u044F \u0438\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u0438\u044F \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F...");
                    metadata = parser_1.MetadataParser.parseMessage(anyMsg.message);
                    // Проверяем, есть ли описание в метаданных
                    if (!metadata.description || metadata.description.trim() === '') {
                        console.log("  \u2139\uFE0F \u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0432 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0438, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C");
                        skipped++;
                        return [3 /*break*/, 9];
                    }
                    // Обновляем книгу с новым описанием
                    console.log("  \uD83D\uDD04 \u041E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C \u043A\u043D\u0438\u0433\u0443 \u0441 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435\u043C...");
                    updateData = { description: metadata.description };
                    return [4 /*yield*/, supabase
                            .from('books')
                            .update(updateData)
                            .eq('id', typedBook.id)];
                case 7:
                    updateError = (_b.sent()).error;
                    if (updateError) {
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u043A\u043D\u0438\u0433\u0438:", updateError);
                        errors++;
                    }
                    else {
                        console.log("  \u2705 \u041A\u043D\u0438\u0433\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0441 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435\u043C");
                        updated++;
                    }
                    processed++;
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _b.sent();
                    typedBook = book;
                    console.error("\u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043A\u043D\u0438\u0433\u0438 ".concat(typedBook.author, " - ").concat(typedBook.title, ":"), error_1);
                    errors++;
                    return [3 /*break*/, 9];
                case 9:
                    _i++;
                    return [3 /*break*/, 3];
                case 10:
                    console.log("\u2705 \u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0439 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430: ".concat(processed, " \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E, ").concat(updated, " \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E, ").concat(skipped, " \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E, ").concat(errors, " \u043E\u0448\u0438\u0431\u043E\u043A"));
                    return [2 /*return*/, {
                            success: true,
                            message: "\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E ".concat(processed, " \u043A\u043D\u0438\u0433, \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E ").concat(updated, " \u043A\u043D\u0438\u0433"),
                            processed: processed,
                            updated: updated,
                            skipped: skipped,
                            errors: errors
                        }];
                case 11:
                    error_2 = _b.sent();
                    console.error('❌ Ошибка синхронизации описаний:', error_2);
                    return [2 /*return*/, {
                            success: false,
                            message: error_2 instanceof Error ? error_2.message : 'Неизвестная ошибка синхронизации описаний',
                            processed: 0,
                            updated: 0,
                            skipped: 0,
                            errors: 1
                        }];
                case 12: return [2 /*return*/];
            }
        });
    });
}
// Если скрипт запущен напрямую, выполняем синхронизацию
if (require.main === module) {
    syncMissingDescriptions(50)
        .then(function (result) {
        console.log('Результат синхронизации описаний:', result);
        // Принудительно завершаем скрипт через 1 секунду
        setTimeout(function () {
            console.log('🔒 Скрипт принудительно завершен');
            process.exit(0);
        }, 1000);
    })
        .catch(function (error) {
        console.error('❌ Ошибка при выполнении скрипта:', error);
        // Принудительно завершаем скрипт и в случае ошибки
        setTimeout(function () {
            process.exit(1);
        }, 1000);
    });
}
