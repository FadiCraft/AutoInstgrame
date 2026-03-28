const { chromium, devices } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // قراءة ملف الكوكيز الذي وضعته في GitHub Secrets
  const cookiesRaw = JSON.parse(fs.readFileSync('auth.json', 'utf8'));
  
  // تحويل الكوكيز لتنسيق Playwright
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

  const context = await browser.newContext({
    ...devices['iPhone 12'],
    storageState: storageState
  });

  const page = await context.newPage();
  
  console.log("جاري محاولة فتح إنستغرام...");
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });

  // التحقق من نجاح الدخول
  const html = await page.content();
  if (html.includes('aria-label="Home"') || html.includes('aria-label="Direct messages"')) {
    console.log("✅ تم تسجيل الدخول بنجاح!");
  } else {
    console.log("❌ فشل الدخول. قد تحتاج لتحديث الكوكيز.");
    // تصوير الصفحة لمعرفة ماذا يظهر (مفيد للتصحيح)
    await page.screenshot({ path: 'error.png' });
  }

  await browser.close();
})();
