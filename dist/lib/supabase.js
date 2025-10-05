"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.supabaseAdmin = exports.getSupabaseAdmin = exports.supabase = exports.getSupabase = exports.createClient = void 0;
exports.uploadFileToStorage = uploadFileToStorage;
exports.upsertBookRecord = upsertBookRecord;
var supabase_js_1 = require("@supabase/supabase-js");
var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
var supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Проверяем переменные окружения только если они действительно нужны
function checkEnvVars() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
    }
}
// Экспортируем функцию создания клиента для возможности создавать отдельные инстансы
var createClient = function () {
    // Откладываем проверку переменных окружения до фактического использования
    if (!supabaseUrl || !supabaseAnonKey) {
        checkEnvVars();
    }
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
};
exports.createClient = createClient;
// Ленивая инициализация клиентов
var _supabase = null;
var _supabaseAdmin = null;
// Экспортируем геттер для дефолтного инстанса
var getSupabase = function () {
    if (!_supabase) {
        checkEnvVars();
        _supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
    }
    return _supabase;
};
exports.getSupabase = getSupabase;
// Экспортируем дефолтный инстанс для обратной совместимости
exports.supabase = new Proxy({}, {
    get: function (target, prop) {
        return (0, exports.getSupabase)()[prop];
    }
});
// Создаем клиент с service role для серверных операций (загрузка файлов, админские операции)
var getSupabaseAdmin = function () {
    if (!_supabaseAdmin) {
        // Перечитываем переменные окружения при первом вызове
        var url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && key) {
            _supabaseAdmin = (0, supabase_js_1.createClient)(url, key, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });
        }
    }
    return _supabaseAdmin;
};
exports.getSupabaseAdmin = getSupabaseAdmin;
// Экспортируем прокси для обратной совместимости
exports.supabaseAdmin = new Proxy({}, {
    get: function (target, prop) {
        var admin = (0, exports.getSupabaseAdmin)();
        if (!admin) {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
        }
        return admin[prop];
    }
});
// Upload a buffer to Supabase Storage
// Использует service role для загрузки файлов (требуется для Storage)
function uploadFileToStorage(bucket_1, path_1, buffer_1) {
    return __awaiter(this, arguments, void 0, function (bucket, path, buffer, mimeType) {
        var admin, _a, data, error;
        if (mimeType === void 0) { mimeType = 'application/octet-stream'; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    admin = (0, exports.getSupabaseAdmin)();
                    if (!admin) {
                        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Cannot upload files to storage.');
                    }
                    return [4 /*yield*/, admin.storage.from(bucket).upload(path, buffer, {
                            contentType: mimeType,
                            upsert: true,
                        })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        console.error("Error uploading file to ".concat(bucket, "/").concat(path, ":"), error);
                        throw error;
                    }
                    console.log("\u2705 Successfully uploaded file to ".concat(bucket, "/").concat(path));
                    return [2 /*return*/, data];
            }
        });
    });
}
// Insert or update a book record
function upsertBookRecord(book) {
    return __awaiter(this, void 0, void 0, function () {
        var admin, _a, existingBook, fetchError, updateData, _b, data, error, titleWords, authorWords, allSearchWords_1, searchPromises, results, allMatches, uniqueMatches, matchesWithScores, topMatches;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    admin = (0, exports.getSupabaseAdmin)();
                    if (!admin) {
                        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Cannot upsert book record.');
                    }
                    console.log("\uD83D\uDD0D \u0418\u0449\u0435\u043C \u043A\u043D\u0438\u0433\u0443 \u043F\u043E \u043C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u043C: title=\"".concat(book.title, "\", author=\"").concat(book.author, "\""));
                    if (!(book.title && book.author)) return [3 /*break*/, 8];
                    return [4 /*yield*/, admin
                            .from('books')
                            .select('id')
                            .eq('title', book.title)
                            .eq('author', book.author)
                            .single()];
                case 1:
                    _a = _c.sent(), existingBook = _a.data, fetchError = _a.error;
                    if (!(!fetchError && existingBook)) return [3 /*break*/, 4];
                    console.log("\u2705 \u041D\u0430\u0439\u0434\u0435\u043D\u0430 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u043A\u043D\u0438\u0433\u0430 (\u0442\u043E\u0447\u043D\u043E\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435): ".concat(existingBook.id));
                    updateData = {};
                    // Копируем только те поля, которые есть в новой записи
                    if (book.file_url)
                        updateData.file_url = book.file_url;
                    if (book.file_size)
                        updateData.file_size = book.file_size;
                    if (book.file_format)
                        updateData.file_format = book.file_format;
                    if (book.telegram_file_id)
                        updateData.telegram_file_id = book.telegram_file_id;
                    if (book.storage_path)
                        updateData.storage_path = book.storage_path;
                    if (!(Object.keys(updateData).length > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, admin
                            .from('books')
                            .update(updateData)
                            .eq('id', existingBook.id)
                            .select()
                            .single()];
                case 2:
                    _b = _c.sent(), data = _b.data, error = _b.error;
                    if (error)
                        throw error;
                    console.log("\u2705 \u041A\u043D\u0438\u0433\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0441 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0435\u0439 \u043E \u0444\u0430\u0439\u043B\u0435");
                    return [2 /*return*/, data];
                case 3:
                    // Если нет новых данных, возвращаем существующую запись
                    console.log("\u2139\uFE0F  \u041A\u043D\u0438\u0433\u0430 \u0443\u0436\u0435 \u0438\u043C\u0435\u0435\u0442 \u0432\u0441\u044E \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u0443\u044E \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E");
                    return [2 /*return*/, existingBook];
                case 4:
                    console.log("\u26A0\uFE0F  \u041A\u043D\u0438\u0433\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u043F\u043E \u0442\u043E\u0447\u043D\u043E\u043C\u0443 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044E");
                    if (fetchError) {
                        console.log("  \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0438\u0441\u043A\u0430: ".concat(fetchError.message));
                    }
                    _c.label = 5;
                case 5:
                    // Если точное совпадение не найдено, пробуем поиск с релевантностью
                    console.log("\uD83D\uDD0D \u041F\u0440\u043E\u0431\u0443\u0435\u043C \u043F\u043E\u0438\u0441\u043A \u0441 \u0440\u0435\u043B\u0435\u0432\u0430\u043D\u0442\u043D\u043E\u0441\u0442\u044C\u044E \u0434\u043B\u044F: title=\"".concat(book.title, "\", author=\"").concat(book.author, "\""));
                    titleWords = (book.title || '').split(/\s+/).filter(function (word) { return word.length > 2; });
                    authorWords = (book.author || '').split(/\s+/).filter(function (word) { return word.length > 2; });
                    allSearchWords_1 = __spreadArray(__spreadArray([], titleWords, true), authorWords, true).filter(function (word) { return word.length > 0; });
                    console.log("  \u0421\u043B\u043E\u0432\u0430 \u0434\u043B\u044F \u043F\u043E\u0438\u0441\u043A\u0430: [".concat(allSearchWords_1.join(', '), "]"));
                    if (!(allSearchWords_1.length > 0)) return [3 /*break*/, 7];
                    searchPromises = allSearchWords_1.map(function (word) { return __awaiter(_this, void 0, void 0, function () {
                        var titleMatches, authorMatches, allMatches, uniqueMatches;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, admin
                                        .from('books')
                                        .select('id, title, author')
                                        .ilike('title', "%".concat(word, "%"))
                                        .limit(5)];
                                case 1:
                                    titleMatches = (_a.sent()).data;
                                    return [4 /*yield*/, admin
                                            .from('books')
                                            .select('id, title, author')
                                            .ilike('author', "%".concat(word, "%"))
                                            .limit(5)];
                                case 2:
                                    authorMatches = (_a.sent()).data;
                                    allMatches = __spreadArray(__spreadArray([], (titleMatches || []), true), (authorMatches || []), true);
                                    uniqueMatches = allMatches.filter(function (bookItem, index, self) {
                                        return index === self.findIndex(function (b) { return b.id === bookItem.id; });
                                    });
                                    return [2 /*return*/, uniqueMatches];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(searchPromises)];
                case 6:
                    results = _c.sent();
                    allMatches = results.flat();
                    uniqueMatches = allMatches.filter(function (bookItem, index, self) {
                        return index === self.findIndex(function (b) { return b.id === bookItem.id; });
                    });
                    matchesWithScores = uniqueMatches.map(function (bookItem) {
                        var bookTitleWords = bookItem.title.toLowerCase().split(/\s+/);
                        var bookAuthorWords = bookItem.author.toLowerCase().split(/\s+/);
                        var allBookWords = __spreadArray(__spreadArray([], bookTitleWords, true), bookAuthorWords, true);
                        // Считаем количество совпадений поисковых слов с словами в книге
                        var score = 0;
                        for (var _i = 0, allSearchWords_2 = allSearchWords_1; _i < allSearchWords_2.length; _i++) {
                            var searchWord = allSearchWords_2[_i];
                            var normalizedSearchWord = searchWord.toLowerCase();
                            var found = false;
                            for (var _a = 0, allBookWords_1 = allBookWords; _a < allBookWords_1.length; _a++) {
                                var bookWord = allBookWords_1[_a];
                                var normalizedBookWord = bookWord.toLowerCase();
                                // Проверяем точное совпадение или частичное включение
                                if (normalizedBookWord.includes(normalizedSearchWord) || normalizedSearchWord.includes(normalizedBookWord)) {
                                    score++;
                                    found = true;
                                    break; // Не увеличиваем счетчик больше одного раза для одного поискового слова
                                }
                            }
                        }
                        return __assign(__assign({}, bookItem), { score: score });
                    });
                    // Сортируем по убыванию счета
                    matchesWithScores.sort(function (a, b) { return b.score - a.score; });
                    topMatches = matchesWithScores.slice(0, 5);
                    // Возвращаем только совпадения с релевантностью >= 2
                    return [2 /*return*/, topMatches.filter(function (match) { return match.score >= 2; })];
                case 7:
                    console.log("\u26A0\uFE0F  \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u043B\u043E\u0432 \u0434\u043B\u044F \u043F\u043E\u0438\u0441\u043A\u0430 \u0441 \u0440\u0435\u043B\u0435\u0432\u0430\u043D\u0442\u043D\u043E\u0441\u0442\u044C\u044E");
                    _c.label = 8;
                case 8:
                    // Если книга не найдена по релевантности или нет достаточных метаданных, не создаем новую запись
                    console.log("\u26A0\uFE0F  \u041A\u043D\u0438\u0433\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0438 \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u0441\u043E\u0437\u0434\u0430\u043D\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438");
                    return [2 /*return*/, null];
            }
        });
    });
}
