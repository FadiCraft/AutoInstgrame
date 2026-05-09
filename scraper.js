const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function scrapeChannels() {
    console.log('--- بدء عملية الاستخراج ---');
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    const page = await browser.newPage();
    const m3u8Links = new Set(); // استخدام Set لتجنب التكرار

    // اعتراض روابط البث m3u8 من الشبكة مباشرة
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (url.includes('.m3u8')) {
            console.log('تم العثور على رابط بث:', url);
            m3u8Links.add(url);
        }
        request.continue();
    });

    try {
        // تعيين User-Agent حقيقي لتجاوز الحماية
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('جاري الدخول إلى الموقع...');
        await page.goto('https://www.yallatv.online/?m=tv&cat=%D8%A7%D9%85+%D8%A8%D9%8A+%D8%B3%D9%8A', {
            waitUntil: 'networkidle2',
            timeout: 90000
        });

        // الانتظار لتجاوز Cloudflare وتحميل المشغل
        console.log('انتظار تحميل المشغل وفك الحماية...');
        await new Promise(r => setTimeout(r, 20000)); 

        // تحويل الـ Set إلى Array وحفظه
        const result = Array.from(m3u8Links);
        fs.writeFileSync('channels.json', JSON.stringify({
            last_update: new Date().toISOString(),
            total: result.length,
            urls: result
        }, null, 2));

        console.log(`تم حفظ ${result.length} روابط بنجاح.`);

    } catch (error) {
        console.error('حدث خطأ أثناء الاستخراج:', error.message);
    } finally {
        await browser.close();
    }
}

scrapeChannels();
