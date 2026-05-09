const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function startScraping() {
    console.log('--- [1] تشغيل المحاكاة البشرية المتقدمة ---');
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const baseUrl = 'https://www.yallatv.online';

    try {
        console.log('--- [2] محاولة اختراق حاجز الحماية... ---');
        
        // الانتقال للموقع
        await page.goto(`${baseUrl}/?m=tv&cat=%D8%A7%D9%85+%D8%A8%D9%8A+%D8%B3%D9%8A`, {
            waitUntil: 'domcontentloaded', 
            timeout: 60000
        });

        // محاكاة حركة بشرية (تحريك الماوس قليلاً)
        await page.mouse.move(100, 100);
        await Promise.resolve(r => setTimeout(r, 1000));
        await page.mouse.move(200, 300);

        console.log('--- [3] الانتظار الذكي لظهور العناصر (Selector) ---');
        
        // سننتظر ظهور أي عنصر يحمل كلاس category-block
        try {
            await page.waitForSelector('.category-block', { timeout: 30000 });
            console.log('✅ تم اختراق الحماية وظهور العناصر بنجاح!');
        } catch (e) {
            console.log('❌ فشل الانتظار الذكي. جاري أخذ لقطة شاشة للتحليل...');
            await page.screenshot({ path: 'blocked_reason.png', fullPage: true });
            
            // محاولة أخيرة: هل المحتوى داخل Iframe رئيسي؟ سنفحص الأكواد
            const content = await page.content();
            fs.writeFileSync('page_source.html', content);
            throw new Error("Cloudflare Blocked the request");
        }

        // استخراج البيانات بناءً على هيكلك
        const channels = await page.evaluate((base) => {
            const results = [];
            const items = document.querySelectorAll('.category-block[data-category="ام بي سي"] .stream-box');
            
            items.forEach(el => {
                const title = el.querySelector('.stream-title')?.innerText.trim();
                const path = el.getAttribute('href');
                const img = el.querySelector('img')?.getAttribute('src');

                if (title && path) {
                    results.push({
                        title: title,
                        pageUrl: path.startsWith('http') ? path : base + path,
                        logo: img ? (img.startsWith('http') ? img : base + img) : null
                    });
                }
            });
            return results;
        }, baseUrl);

        console.log(`--- [4] تم استخراج ${channels.length} قناة ---`);

        // حفظ البيانات
        fs.writeFileSync('channels.json', JSON.stringify({ 
            success: true,
            count: channels.length,
            updated_at: new Date().toISOString(),
            channels: channels 
        }, null, 2));

    } catch (error) {
        console.error('🔴 تعطل السكربت:', error.message);
    } finally {
        await browser.close();
        console.log('--- [5] إغلاق الجلسة ---');
    }
}

startScraping();
