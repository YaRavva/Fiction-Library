"use strict";
/**
 * Тестовый скрипт для проверки поиска файлов в архиве
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
Object.defineProperty(exports, "__esModule", { value: true });
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
function testFileSearch() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, book, bookError, syncService, archiveResults, searchTitle, searchAuthor, _i, archiveResults_1, result, filename, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    console.log('🔍 Тестирование поиска файлов в архиве...');
                    return [4 /*yield*/, supabaseAdmin
                            .from('books')
                            .select('id, title, author')
                            .eq('id', 'c4976328-a5be-40ba-aa24-360212f42b87')
                            .single()];
                case 1:
                    _a = _b.sent(), book = _a.data, bookError = _a.error;
                    if (bookError) {
                        console.error('Error fetching book:', bookError);
                        return [2 /*return*/];
                    }
                    console.log("\uD83D\uDCDA \u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u043A\u043D\u0438\u0433\u0430: ".concat(book.author, " - ").concat(book.title));
                    // Ищем файлы в архиве
                    console.log('🔍 Поиск файлов в канале архива...');
                    return [4 /*yield*/, sync_1.TelegramSyncService.getInstance()];
                case 2:
                    syncService = _b.sent();
                    return [4 /*yield*/, syncService.downloadAndProcessFilesDirectly(5)];
                case 3:
                    archiveResults = _b.sent();
                    console.log("\uD83D\uDCC1 \u041D\u0430\u0439\u0434\u0435\u043D\u043E \u0444\u0430\u0439\u043B\u043E\u0432: ".concat(archiveResults.length));
                    searchTitle = book.title.toLowerCase();
                    searchAuthor = book.author.toLowerCase();
                    console.log("\uD83D\uDD0E \u041F\u043E\u0438\u0441\u043A \u0444\u0430\u0439\u043B\u0430 \u0434\u043B\u044F: ".concat(book.author, " - ").concat(book.title));
                    // Ищем точное совпадение по автору и названию
                    for (_i = 0, archiveResults_1 = archiveResults; _i < archiveResults_1.length; _i++) {
                        result = archiveResults_1[_i];
                        if (result.success && result.filename) {
                            filename = result.filename.toLowerCase();
                            console.log("  \uD83D\uDCC4 \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430: ".concat(result.filename));
                            // Проверяем различные варианты совпадения
                            if (filename.includes(searchAuthor.replace(/\s+/g, '_')) &&
                                filename.includes(searchTitle.replace(/\s+/g, '_'))) {
                                console.log("\uD83C\uDFAF \u041D\u0430\u0439\u0434\u0435\u043D \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0439 \u0444\u0430\u0439\u043B: ".concat(result.filename));
                            }
                        }
                    }
                    console.log('✅ Тест завершен');
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _b.sent();
                    console.error('Test error:', error_1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Run the test
testFileSearch();
