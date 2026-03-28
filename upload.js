const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("🚀 بدء تشغيل البوت (واجهة الحاسوب)...");

  // 1. التحقق من الملفات
  if (!fs.existsSync('auth.json') || !fs.existsSync('post.jpg')) {
    console.error("❌ تأكد من وجود auth.json و post.jpg");
    process.exit(1);
  }

  const cookiesRaw = JSON.parse(fs.readFileSync('auth.json', 'utf8'));

  // 2. تحويل الكوكيز
  const processedCookies = cookiesRaw.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
    path: c.path || "/",
    expires: c.expirationDate || -1,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: (c.sameSite && ["strict", "lax", "none"].includes(c.sameSite.toLowerCase())) ? c.sameSite : "Lax"
  }));

  // 3. تشغيل المتصفح ككمبيوتر عادي
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    storageState: { cookies: processedCookies }
  });

  const page = await context.newPage();

  try {
    console.log("🌐 جاري فتح إنستغرام...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });

    // التأكد من تسجيل الدخول
    await page.waitForTimeout(5000);
    const isLoggedIn = await page.isVisible('svg[aria-label="New post"], svg[aria-label="Create"]');
    if (!isLoggedIn) {
      console.log("⚠️ لم يتم التعرف على واجهة الدخول. جاري أخذ لقطة شاشة للتحقق...");
      await page.screenshot({ path: 'login_check.png' });
      // سنكمل المحاولة لعل الزر موجود ولكن بـ Selector مختلف
    } else {
      console.log("✅ تم تسجيل الدخول بنجاح!");
    }

    // 4. الضغط على زر Create (الزائد في القائمة الجانبية)
    console.log("📸 جاري الضغط على زر الإنشاء...");
    const createBtn = 'svg[aria-label="New post"], svg[aria-label="Create"], span:has-text("Create")';
    await page.waitForSelector(createBtn, { timeout: 15000 });
    await page.click(createBtn);

    // 5. رفع الصورة
    console.log("📤 اختيار الصورة...");
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Select from computer")')
    ]);
    await fileChooser.setFiles('post.jpg');

    // 6. المتابعة (Next) - واجهة الكمبيوتر تطلب الضغط مرتين
    console.log("➡️ جاري الانتقال للخطوة التالية...");
    await page.waitForSelector('div:has-text("Next")', { timeout: 10000 });
    await page.click('div:has-text("Next")');
    
    await page.waitForTimeout(2000);
    await page.click('div:has-text("Next")');

    // 7. الوصف والنشر
    console.log("✍️ كتابة الوصف...");
    await page.waitForSelector('div[aria-label="Write a caption..."]');
    await page.fill('div[aria-label="Write a caption..."]', 'Hello from my automated Node.js script! 🤖📈');

    console.log("🚀 جاري النشر...");
    await page.click('div:has-text("Share")');

    // انتظار نجاح النشر (ظهور رسالة Your post has been shared)
    await page.waitForSelector('text=Your post has been shared', { timeout: 30000 });
    console.log("🎉 تم النشر بنجاح على إنستغرام!");

  } catch (error) {
    console.error("❌ حدث خطأ:", error.message);
    await page.screenshot({ path: 'error_desktop.png' });
  } finally {
    await browser.close();
  }
})();
