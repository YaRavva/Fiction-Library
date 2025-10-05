"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverSupabase = void 0;
var supabase_js_1 = require("@supabase/supabase-js");
// Откладываем проверку переменных окружения до момента создания клиента
var supabaseUrl;
var serviceRoleKey;
function initializeEnv() {
    supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
}
exports.serverSupabase = new Proxy({}, {
    get: function (target, prop) {
        // Инициализируем переменные окружения при первом обращении
        if (!supabaseUrl || !serviceRoleKey) {
            initializeEnv();
        }
        // Проверяем переменные окружения
        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
        }
        // Создаем клиент при первом обращении
        var typedTarget = target;
        if (!typedTarget._client) {
            typedTarget._client = (0, supabase_js_1.createClient)(supabaseUrl, serviceRoleKey);
        }
        // Перенаправляем вызовы к реальному клиенту
        return typedTarget._client[prop];
    }
});
