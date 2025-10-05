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
var supabase_js_1 = require("@supabase/supabase-js");
// Используем те же переменные окружения, что и в основном приложении
var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Отсутствуют необходимые переменные окружения:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'не задан');
    console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey || 'не задан');
    console.error('\nПожалуйста, убедитесь, что переменные окружения установлены.');
    process.exit(1);
}
var supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
function createSeriesForAllBooks() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, books, booksError, processed, updated, skipped, errors, _i, books_1, book, bookComposition, seriesData, _b, insertedSeries, seriesError, newSeriesId, updateError, error_1, error_2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 9, , 10]);
                    console.log('🚀 Начинаем обработку всех книг в базе данных');
                    return [4 /*yield*/, supabase
                            .from('books')
                            .select('*')];
                case 1:
                    _a = _c.sent(), books = _a.data, booksError = _a.error;
                    if (booksError) {
                        console.error('❌ Ошибка при получении списка книг:', booksError);
                        return [2 /*return*/];
                    }
                    console.log("\uD83D\uDCDA \u041D\u0430\u0439\u0434\u0435\u043D\u043E \u043A\u043D\u0438\u0433: ".concat(books.length));
                    processed = 0;
                    updated = 0;
                    skipped = 0;
                    errors = 0;
                    _i = 0, books_1 = books;
                    _c.label = 2;
                case 2:
                    if (!(_i < books_1.length)) return [3 /*break*/, 8];
                    book = books_1[_i];
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 6, , 7]);
                    processed++;
                    console.log("\n\uD83D\uDCDD \u041E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C \u043A\u043D\u0438\u0433\u0443 ".concat(processed, "/").concat(books.length, ": ").concat(book.author, " - ").concat(book.title));
                    bookComposition = null;
                    try {
                        // Пытаемся распарсить поле books как JSON
                        if (typeof book.books === 'string') {
                            bookComposition = JSON.parse(book.books);
                        }
                        else if (Array.isArray(book.books)) {
                            bookComposition = book.books;
                        }
                    }
                    catch (parseError) {
                        // Если не удалось распарсить, пропускаем
                        console.log("  \u2139\uFE0F  \u0423 \u043A\u043D\u0438\u0433\u0438 \u043D\u0435\u0442 \u0441\u043E\u0441\u0442\u0430\u0432\u0430 (\u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0441\u043F\u0430\u0440\u0441\u0438\u0442\u044C \u043F\u043E\u043B\u0435 books)");
                        skipped++;
                        return [3 /*break*/, 7];
                    }
                    // Проверяем, есть ли состав
                    if (!bookComposition || !Array.isArray(bookComposition) || bookComposition.length === 0) {
                        console.log("  \u2139\uFE0F  \u0423 \u043A\u043D\u0438\u0433\u0438 \u043D\u0435\u0442 \u0441\u043E\u0441\u0442\u0430\u0432\u0430");
                        skipped++;
                        return [3 /*break*/, 7];
                    }
                    // Проверяем, привязана ли книга к серии
                    if (book.series_id) {
                        console.log("  \u2139\uFE0F  \u041A\u043D\u0438\u0433\u0430 \u0443\u0436\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u0430 \u043A \u0441\u0435\u0440\u0438\u0438");
                        skipped++;
                        return [3 /*break*/, 7];
                    }
                    console.log("  \uD83D\uDCDA \u0423 \u043A\u043D\u0438\u0433\u0438 \u0435\u0441\u0442\u044C \u0441\u043E\u0441\u0442\u0430\u0432 \u0438\u0437 ".concat(bookComposition.length, " \u043A\u043D\u0438\u0433, \u0441\u043E\u0437\u0434\u0430\u0435\u043C \u0441\u0435\u0440\u0438\u044E..."));
                    seriesData = {
                        title: book.title,
                        author: book.author,
                        description: book.description || '',
                        genres: book.genres || [],
                        tags: book.tags || [],
                        rating: book.rating || null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        series_composition: bookComposition
                    };
                    // Добавляем обложку, если она есть
                    if (book.cover_url) {
                        seriesData.cover_url = book.cover_url;
                    }
                    // Добавляем telegram_post_id, если он есть
                    if (book.telegram_post_id) {
                        seriesData.telegram_post_id = book.telegram_post_id;
                    }
                    return [4 /*yield*/, supabase
                            .from('series')
                            .insert(seriesData)
                            .select()
                            .single()];
                case 4:
                    _b = _c.sent(), insertedSeries = _b.data, seriesError = _b.error;
                    if (seriesError) {
                        console.warn("  \u26A0\uFE0F  \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u0441\u0435\u0440\u0438\u0438:", seriesError);
                        errors++;
                        return [3 /*break*/, 7];
                    }
                    newSeriesId = insertedSeries.id;
                    console.log("  \u2705 \u0421\u0435\u0440\u0438\u044F \u0441\u043E\u0437\u0434\u0430\u043D\u0430: ".concat(newSeriesId));
                    return [4 /*yield*/, supabase
                            .from('books')
                            .update({ series_id: newSeriesId })
                            .eq('id', book.id)];
                case 5:
                    updateError = (_c.sent()).error;
                    if (updateError) {
                        console.warn("  \u26A0\uFE0F  \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0435 \u043A\u043D\u0438\u0433\u0438 \u043A \u0441\u0435\u0440\u0438\u0438:", updateError);
                        errors++;
                        return [3 /*break*/, 7];
                    }
                    console.log("  \u2705 \u041A\u043D\u0438\u0433\u0430 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u0430 \u043A \u0441\u0435\u0440\u0438\u0438");
                    updated++;
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _c.sent();
                    console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435 \u043A\u043D\u0438\u0433\u0438 ".concat(book.id, ":"), error_1);
                    errors++;
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8:
                    console.log("\n\uD83D\uDCCA \u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430:");
                    console.log("  - \u041E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E: ".concat(processed));
                    console.log("  - \u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E: ".concat(updated));
                    console.log("  - \u041F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E: ".concat(skipped));
                    console.log("  - \u041E\u0448\u0438\u0431\u043E\u043A: ".concat(errors));
                    console.log('\n✅ Скрипт завершен!');
                    return [3 /*break*/, 10];
                case 9:
                    error_2 = _c.sent();
                    console.error('❌ Ошибка в скрипте:', error_2);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
// Запускаем скрипт
createSeriesForAllBooks();
