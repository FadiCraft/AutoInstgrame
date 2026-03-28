const fs = require('fs');
const path = require('path');

// تحديد المسار الكامل للملف لضمان الوصول إليه
const authPath = path.join(__dirname, 'auth.json');

if (!fs.existsSync(authPath)) {
    console.error("❌ خطأ: ملف auth.json غير موجود في المسار:", authPath);
    process.exit(1);
}

const fileContent = fs.readFileSync(authPath, 'utf8');
console.log("📏 حجم الملف المكتشف:", fileContent.length, "حرف");

if (fileContent.trim().length === 0) {
    console.error("❌ خطأ: ملف auth.json موجود ولكنه فارغ تماماً!");
    process.exit(1);
}

// الآن نحاول التحليل
let cookiesRaw;
try {
    cookiesRaw = JSON.parse(fileContent);
    console.log("✅ تم تحليل JSON بنجاح.");
} catch (e) {
    console.error("❌ خطأ في تنسيق JSON داخل الملف:", e.message);
    console.log("محتوى الملف الذي تسبب في الخطأ هو:", fileContent);
    process.exit(1);
}
