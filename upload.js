const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("🚀 بدء تشغيل البوت (إصدار الرفع المباشر)...");

  if (!fs.existsSync('auth.json') || !fs.existsSync('post.jpg')) {
    console.error("❌ ملفات ناقصة! تأكد من وجود auth.json و post.jpg");
    process.exit(1);
  }

  const rawData = fs.readFileSync('auth.json', 'utf8');
  let cookiesRaw = JSON.parse(rawData);

  const processedCookies = cookiesRaw.map(c => {
    let sameSiteValue = "Lax";
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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    storageState: { cookies: processedCookies },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  });

  context.setDefaultTimeout(60000);
  const page = await context.newPage();

  try {
    console.log("🌐 جاري الدخول إلى إنستغرام...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });

    console.log("⏳ انتظار استقرار الواجهة...");
    await page.waitForTimeout(8000);

    // 1. الضغط على زر Create
    console.log("📸 الضغط على زر Create...");
    const createBtn = 'svg[aria-label="New post"], svg[aria-label="Create"], [aria-label="Create"]';
    await page.waitForSelector(createBtn, { state: 'visible' });
    await page.click(createBtn);
    
    await page.waitForTimeout(3000);

    // 2. الرفع المباشر (Direct Upload) - الطريقة الأضمن لـ GitHub Actions
    console.log("📤 جاري رفع ملف الصورة مباشرة...");
    
    // نبحث عن عنصر الـ input المخفي الذي يستقبل الصور
    const inputFile = await page.$('input[type="file"]');
    if (inputFile) {
      await inputFile.setInputFiles('post.jpg');
      console.log("✅ تم رفع الملف بنجاح عبر Input.");
    } else {
      console.log("⚠️ لم نجد input، سأحاول الطريقة التقليدية...");
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('button:has-text("Select from computer")')
      ]);
      await fileChooser.setFiles('post.jpg');
    }

    // 3. الانتقال للمراحل التالية (Next)
    console.log("➡️ الضغط على Next (1)...");
    const nextBtn = 'div[role="button"]:has-text("Next")';
    await page.waitForSelector(nextBtn);
    await page.click(nextBtn);
    
    await page.waitForTimeout(2000);
    console.log("➡️ الضغط على Next (2)...");
    await page.click(nextBtn);

    // 4. كتابة الوصف
    console.log("✍️ إضافة الوصف...");
    const captionBox = 'div[aria-label="Write a caption..."]';
    await page.waitForSelector(captionBox);
    await page.fill(captionBox, 'Automated Post #1 using Playwright and GitHub Actions! 🤖🚀');

    // 5. النشر النهائي
    console.log("🚀 جاري الضغط على Share...");
    await page.click('div[role="button"]:has-text("Share")');

    // انتظار رسالة النجاح
    console.log("⏳ انتظار تأكيد النشر من إنستغرام...");
    await page.waitForSelector('text=Your post has been shared', { timeout: 60000 });
    console.log("🎉 مبروك! تم النشر بنجاح.");

  } catch (error) {
    console.error("❌ حدث خطأ:", error.message);
    await page.screenshot({ path: 'final_debug_error.png' });
  } finally {
    await browser.close();
    console.log("🔒 إغلاق المتصفح.");
  }
})();
