const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("🚀 بدء تشغيل البوت...");

  // 1. التحقق من وجود ملف الكوكيز والصورة
  const authPath = path.join(__dirname, 'auth.json');
  if (!fs.existsSync(authPath)) {
    console.error("❌ خطأ: ملف auth.json غير موجود!");
    process.exit(1);
  }
  if (!fs.existsSync('post.jpg')) {
    console.error("❌ خطأ: ملف post.jpg غير موجود في المجلد!");
    process.exit(1);
  }

  const rawData = fs.readFileSync(authPath, 'utf8');
  let cookiesRaw = JSON.parse(rawData);

  // 2. معالجة الكوكيز لتناسب متصفح Chromium (حل مشكلة SameSite)
  const processedCookies = cookiesRaw.map(c => {
    let sameSiteValue = "Lax";
    if (c.sameSite) {
      const ss = c.sameSite.toLowerCase();
      if (ss === "no_restriction" || ss === "none") sameSiteValue = "None";
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

  // 3. إعداد المتصفح بمحاكاة آيفون 12
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    storageState: { cookies: processedCookies }
  });

  const page = await context.newPage();

  try {
    console.log("🌐 جاري الدخول إلى إنستغرام...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });

    // التأكد من تسجيل الدخول
    const isLoggedIn = await page.isVisible('svg[aria-label="Home"], svg[aria-label="New Post"], a[href="/"]');
    if (!isLoggedIn) {
      console.log("⚠️ فشل تسجيل الدخول. قد تحتاج لتحديث الكوكيز.");
      await page.screenshot({ path: 'login_fail.png' });
      process.exit(1);
    }
    console.log("✅ تم تسجيل الدخول بنجاح!");

    // 4. البحث عن زر الرفع بذكاء (تجنب الـ Timeout)
    console.log("📸 جاري البحث عن زر الرفع...");
    const uploadSelectors = [
      'svg[aria-label="New Post"]',
      'svg[aria-label="Create"]',
      'svg[aria-label="منشور جديد"]',
      'a[href*="create/select"]',
      'div[role="menuitem"] svg'
    ];

    let found = false;
    for (const selector of uploadSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        found = true;
        console.log(`✔️ تم النقر باستخدام: ${selector}`);
        break;
      } catch (e) { continue; }
    }

    if (!found) throw new Error("لم يتم العثور على زر الرفع.");

    // 5. رفع ملف الصورة
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Select from computer"), span:has-text("Select")').catch(() => {}) 
    ]);
    await fileChooser.setFiles('post.jpg');
    console.log("📤 تم اختيار الصورة.");

    // 6. المتابعة (Next)
    await page.waitForTimeout(3000);
    const nextBtn = 'button:has-text("Next"), div[role="button"]:has-text("Next")';
    await page.click(nextBtn);
    await page.waitForTimeout(1000);
    await page.click(nextBtn);

    // 7. كتابة الوصف والنشر
    console.log("✍️ إضافة الوصف...");
    await page.fill('div[aria-label="Write a caption..."]', 'Automatic post via Node.js 🤖🚀');
    
    await page.click('button:has-text("Share")');
    console.log("⏳ جاري النشر النهائي...");
    
    await page.waitForTimeout(10000);
    console.log("🎉 تمت العملية بنجاح!");

  } catch (error) {
    console.error("❌ حدث خطأ:", error.message);
    await page.screenshot({ path: 'error_debug.png' });
  } finally {
    await browser.close();
  }
})();
