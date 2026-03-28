const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("🚀 بدء تشغيل البوت (إصدار الشبكة المستقر)...");

  if (!fs.existsSync('auth.json') || !fs.existsSync('post.jpg')) {
    console.error("❌ ملفات ناقصة!");
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

  // تعيين وقت انتظار أطول افتراضي للعمليات (60 ثانية بدلاً من 30)
  context.setDefaultTimeout(60000);
  const page = await context.newPage();

  try {
    console.log("🌐 جاري الدخول إلى إنستغرام (محاولة تحميل سريعة)...");
    
    // الانتظار فقط حتى يتم تحميل محتوى الصفحة الأساسي (أسرع من networkidle)
    await page.goto('https://www.instagram.com/', { 
        waitUntil: 'domcontentloaded', 
        timeout: 90000 
    });

    console.log("⏳ انتظار استقرار العناصر...");
    await page.waitForTimeout(7000); // انتظار يدوي للتأكد من ظهور الأزرار

    // التأكد من تسجيل الدخول
    const isLoggedIn = await page.isVisible('svg[aria-label="Home"], svg[aria-label="New post"], [aria-label="Create"]');
    if (!isLoggedIn) {
      console.log("⚠️ واجهة تسجيل الدخول غير مؤكدة، سأحاول المتابعة...");
      await page.screenshot({ path: 'check_interface.png' });
    } else {
      console.log("✅ تم تسجيل الدخول!");
    }

    console.log("📸 محاولة الضغط على زر Create...");
    const createBtn = 'svg[aria-label="New post"], svg[aria-label="Create"], [aria-label="Create"], a[href="#"]';
    await page.waitForSelector(createBtn, { state: 'visible' });
    await page.click(createBtn);

    console.log("📤 رفع الصورة...");
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Select from computer")').catch(() => page.click('div[role="button"]:has-text("Select from computer")'))
    ]);
    await fileChooser.setFiles('post.jpg');

    console.log("➡️ المتابعة (Next)...");
    const nextBtn = 'div[role="button"]:has-text("Next")';
    await page.waitForSelector(nextBtn);
    await page.click(nextBtn);
    await page.waitForTimeout(2000);
    await page.click(nextBtn);

    console.log("✍️ إضافة الوصف...");
    await page.waitForSelector('div[aria-label="Write a caption..."]');
    await page.fill('div[aria-label="Write a caption..."]', 'Testing Instagram Automation with Playwright! 🤖✨');

    console.log("🚀 نشر...");
    await page.click('div[role="button"]:has-text("Share")');

    await page.waitForSelector('text=Your post has been shared', { timeout: 60000 });
    console.log("🎉 تم النشر بنجاح!");

  } catch (error) {
    console.error("❌ حدث خطأ:", error.message);
    await page.screenshot({ path: 'error_debug.png' });
  } finally {
    await browser.close();
    console.log("🔒 إغلاق المتصفح.");
  }
})();
