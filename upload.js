const { chromium, devices } = require('playwright');
const fs = require('fs');

(async () => {
  // 1. تشغيل المتصفح في وضع الخفاء
  const browser = await chromium.launch({ headless: true });
  
  // 2. قراءة وتحويل الكوكيز (التنسيق الذي أرسلته لي)
  const cookiesRaw = JSON.parse(fs.readFileSync('auth.json', 'utf8'));
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

  // 3. محاكاة هاتف آيفون (لأن واجهة الموبايل أسهل في النشر)
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    storageState: storageState
  });

  const page = await context.newPage();
  
  try {
    console.log("🚀 جاري الدخول إلى إنستغرام...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });

    // 4. الضغط على زر (+) للنشر
    // نستخدم Selectors عامة لأن إنستغرام يغير الأسماء
    await page.click('svg[aria-label="New Post"], svg[aria-label="Create"]');
    console.log("📸 تم الضغط على زر إضافة منشور.");

    // 5. اختيار الصورة (تأكد من وجود ملف باسم post.jpg في المجلد)
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Select from computer"), span:has-text("Select")') 
    ]);
    await fileChooser.setFiles('post.jpg');
    console.log("✅ تم اختيار الصورة.");

    // 6. الضغط على "Next" ثم كتابة الوصف
    await page.click('button:has-text("Next")');
    await page.fill('div[aria-label="Write a caption..."]', 'هذا منشور تلقائي من بوت Node.js 🚀 #Programming #Automation');
    
    // 7. الضغط على "Share"
    await page.click('button:has-text("Share")');
    console.log("🎉 جاري النشر... انتظر قليلاً.");

    // الانتظار للتأكد من اكتمال الرفع
    await page.waitForTimeout(5000); 
    console.log("✔️ تم النشر بنجاح!");

  } catch (error) {
    console.error("❌ حدث خطأ أثناء الأتمتة:", error);
    // تصوير الشاشة في حال حدوث خطأ لمعرفة السبب
    await page.screenshot({ path: 'error_screenshot.png' });
  }

  await browser.close();
})();
