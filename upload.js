const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("🚀 بدء تشغيل البوت...");

  // 1. التحقق من وجود ملف الكوكيز
  const authPath = path.join(__dirname, 'auth.json');
  if (!fs.existsSync(authPath)) {
    console.error("❌ خطأ: ملف auth.json غير موجود!");
    process.exit(1);
  }

  const rawData = fs.readFileSync(authPath, 'utf8');
  let cookiesRaw;
  try {
    cookiesRaw = JSON.parse(rawData);
  } catch (e) {
    console.error("❌ خطأ في تنسيق JSON:", e.message);
    process.exit(1);
  }

  // 2. تحويل الكوكيز لتنسيق Playwright مع معالجة أخطاء SameSite
  const processedCookies = cookiesRaw.map(c => {
    let sameSiteValue = "Lax"; // القيمة الافتراضية الآمنة
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

  const storageState = { cookies: processedCookies };

  // 3. تشغيل المتصفح (محاكاة آيفون 12 لسهولة الواجهة)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    storageState: storageState
  });

  const page = await context.newPage();

  try {
    console.log("🌐 جاري الدخول إلى إنستغرام...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });

    // التأكد من تسجيل الدخول عبر فحص وجود أيقونات الصفحة الرئيسية
    const isLoggedIn = await page.isVisible('svg[aria-label="Home"], svg[aria-label="New Post"]');
    if (!isLoggedIn) {
      console.log("⚠️ فشل تسجيل الدخول. الكوكيز قد تكون منتهية.");
      await page.screenshot({ path: 'login_fail.png' });
      process.exit(1);
    }
    console.log("✅ تم تسجيل الدخول بنجاح!");

    // 4. الضغط على زر (+) وبدء النشر
    console.log("📸 جاري فتح نافذة الرفع...");
    await page.click('svg[aria-label="New Post"], svg[aria-label="Create"]');
    
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Select from computer"), span:has-text("Select")') 
    ]);
    
    // يجب أن يكون لديك ملف post.jpg في المستودع
    if (!fs.existsSync('post.jpg')) {
      throw new Error("ملف post.jpg غير موجود في المجلد!");
    }
    await fileChooser.setFiles('post.jpg');
    console.log("📤 تم اختيار الصورة.");

    // ضغط Next مرتين
    await page.waitForTimeout(3000);
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Next")');

    // كتابة الوصف (Caption)
    console.log("✍️ إضافة الوصف...");
    await page.fill('div[aria-label="Write a caption..."]', 'Auto-posted by my Node.js Bot! 🤖🔥 #Automation #Code');

    // الضغط على Share
    await page.click('button:has-text("Share")');
    console.log("⏳ جاري النشر...");
    
    await page.waitForTimeout(10000); // وقت كافٍ للرفع
    console.log("🎉 تمت العملية بنجاح!");

  } catch (error) {
    console.error("❌ حدث خطأ:", error.message);
    await page.screenshot({ path: 'error.png' });
  } finally {
    await browser.close();
  }
})();
