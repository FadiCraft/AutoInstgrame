const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("🚀 بدء تشغيل البوت (إصدار الحماية المتطور)...");

  // 1. التحقق من وجود الملفات
  if (!fs.existsSync('auth.json') || !fs.existsSync('post.jpg')) {
    console.error("❌ خطأ: تأكد من وجود auth.json و post.jpg في المستودع.");
    process.exit(1);
  }

  const rawData = fs.readFileSync('auth.json', 'utf8');
  let cookiesRaw = JSON.parse(rawData);

  // 2. تنظيف الكوكيز بشكل صارم لتجنب خطأ SameSite
  const processedCookies = cookiesRaw.map(c => {
    // تحديد قيمة sameSite المقبولة فقط لـ Playwright
    let sameSiteValue = "Lax"; // القيمة الافتراضية الأكثر أماناً وتوافقاً
    if (c.sameSite) {
      const ss = c.sameSite.toLowerCase();
      if (ss === "none" || ss === "no_restriction") sameSiteValue = "None";
      else if (ss === "strict") sameSiteValue = "Strict";
      else if (ss === "lax") sameSiteValue = "Lax";
    }

    return {
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
      path: c.path || "/",
      expires: c.expirationDate || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: sameSiteValue
    };
  });

  // 3. تشغيل المتصفح (واجهة حاسوب بدقة Full HD)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: { cookies: processedCookies },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log("🌐 جاري الدخول إلى إنستغرام...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });

    // انتظار بسيط للتأكد من تحميل العناصر الثقيلة
    await page.waitForTimeout(5000);

    // التأكد من تسجيل الدخول (البحث عن أيقونة الملف الشخصي أو الإشعارات)
    const isLoggedIn = await page.isVisible('svg[aria-label="Home"], svg[aria-label="New post"]');
    if (!isLoggedIn) {
      console.log("⚠️ تحذير: لم يتم التعرف على الواجهة كمسجل دخول، جاري المتابعة بحذر...");
      await page.screenshot({ path: 'login_status.png' });
    } else {
      console.log("✅ تم تسجيل الدخول بنجاح!");
    }

    // 4. الضغط على زر Create (الإنشاء)
    console.log("📸 محاولة النقر على زر الإنشاء...");
    const createBtn = 'svg[aria-label="New post"], svg[aria-label="Create"], [aria-label="Create"]';
    await page.waitForSelector(createBtn, { timeout: 15000 });
    await page.click(createBtn);

    // 5. رفع الصورة
    console.log("📤 جاري رفع ملف الصورة...");
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Select from computer")').catch(() => page.click('div[role="button"]:has-text("Select from computer")'))
    ]);
    await fileChooser.setFiles('post.jpg');

    // 6. المتابعة (Next) - واجهة الحاسوب تتطلب نقرتين
    console.log("➡️ الانتقال للمرحلة التالية...");
    const nextBtn = 'div[role="button"]:has-text("Next")';
    await page.waitForSelector(nextBtn, { timeout: 10000 });
    await page.click(nextBtn); // تعديل الصورة
    
    await page.waitForTimeout(2000);
    await page.click(nextBtn); // إضافة الفلاتر

    // 7. كتابة الوصف (Caption) والنشر
    console.log("✍️ إضافة الوصف...");
    const captionBox = 'div[aria-label="Write a caption..."]';
    await page.waitForSelector(captionBox);
    await page.fill(captionBox, 'Posted automatically via Node.js on GitHub Actions! 🤖🚀 #Automation');

    console.log("🚀 جاري الضغط على Share...");
    await page.click('div[role="button"]:has-text("Share")');

    // الانتظار حتى تظهر رسالة النجاح
    console.log("⏳ انتظار تأكيد النشر...");
    await page.waitForSelector('text=Your post has been shared', { timeout: 45000 });
    console.log("🎉 مبروك! تم النشر بنجاح.");

  } catch (error) {
    console.error("❌ حدث خطأ تقني:", error.message);
    await page.screenshot({ path: 'error_final_debug.png' });
  } finally {
    await browser.close();
    console.log("🔒 تم إغلاق المتصفح.");
  }
})();
