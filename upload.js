const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("🚀 بدء تشغيل البوت...");

  // 1. التحقق من وجود ملف الكوكيز
  if (!fs.existsSync('auth.json')) {
    console.error("❌ خطأ: ملف auth.json لم يتم إنشاؤه!");
    process.exit(1);
  }

  const rawData = fs.readFileSync('auth.json', 'utf8');
  const cookiesRaw = JSON.parse(rawData);

  // 2. تحويل الكوكيز لتنسيق Playwright
  const storageState = {
    cookies: cookiesRaw.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expirationDate || -1,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite === "no_restriction" ? "None" : (c.sameSite || "Lax")
    }))
  };

  // 3. تشغيل المتصفح (محاكاة آيفون 12)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    storageState: storageState
  });

  const page = await context.newPage();

  try {
    console.log("🌐 جاري فتح إنستغرام...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });

    // التأكد من تسجيل الدخول
    const loginCheck = await page.isVisible('svg[aria-label="New Post"], svg[aria-label="Home"]');
    if (!loginCheck) {
      console.log("⚠️ يبدو أن الجلسة انتهت أو الكوكيز غير صالحة.");
      await page.screenshot({ path: 'login_error.png' });
      process.exit(1);
    }
    console.log("✅ تم تسجيل الدخول بنجاح!");

    // 4. عملية الرفع
    console.log("📸 جاري محاولة رفع الصورة...");
    await page.click('svg[aria-label="New Post"], svg[aria-label="Create"]');
    
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Select from computer"), span:has-text("Select")') 
    ]);
    
    // تأكد أن post.jpg مرفوع في GitHub
    await fileChooser.setFiles('post.jpg');
    console.log("📤 تم اختيار ملف الصورة.");

    // الضغط على Next (مرتين في واجهة إنستغرام)
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Next")');

    // كتابة الوصف
    console.log("✍️ كتابة الوصف...");
    await page.fill('div[aria-label="Write a caption..."]', 'Auto-posted using Node.js and GitHub Actions! 🤖🚀');

    // النشر النهائي
    await page.click('button:has-text("Share")');
    console.log("⏳ جاري المعالجة والنشر...");
    
    await page.waitForTimeout(8000); // انتظار الرفع
    console.log("🎉 تمت العملية بنجاح!");

  } catch (error) {
    console.error("❌ حدث خطأ غير متوقع:", error.message);
    await page.screenshot({ path: 'fatal_error.png' });
  } finally {
    await browser.close();
  }
})();
