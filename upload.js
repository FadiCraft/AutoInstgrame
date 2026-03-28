const { chromium, devices } = require('playwright');
const fs = require('fs');

(async () => {
  const iPhone = devices['iPhone 12']; // محاكاة موبايل لسهولة النشر
  const browser = await chromium.launch({ headless: true });
  
  // تحميل الجلسة من ملف الكوكيز
  const context = await browser.newContext({
    ...iPhone,
    storageState: 'auth.json' 
  });

  const page = await context.newPage();
  await page.goto('https://www.instagram.com/');

  // كود بسيط للتأكد أننا سجلنا دخول بنجاح
  const title = await page.title();
  console.log("الصفحة الحالية هي: " + title);

  // ملاحظة: هنا سنضيف لاحقاً كود الضغط على زر الرفع
  await browser.close();
})();
