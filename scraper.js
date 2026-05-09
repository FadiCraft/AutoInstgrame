const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function startScraping() {
    console.log('--- [1] تشغيل المتصفح بمحاكاة كاملة ---');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const baseUrl = 'https://www.yallatv.online';

    try {
        // تعيين User-Agent حقيقي جداً
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        console.log('--- [2] الدخول للموقع... ---');
        await page.goto(`${baseUrl}/?m=tv&cat=%D8%A7%D9%85+%D8%A8%D9%8A+%D8%B3%D9%8A`, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // انتظار إضافي للتأكد من فك تشفير الصفحة
        console.log('--- [3] انتظار 15 ثانية لضمان تحميل الـ Scripts... ---');
        await new Promise(r => setTimeout(r, 15000));

        // فحص: هل الهيكل موجود؟
        const bodyHandle = await page.$('body');
        const html = await page.evaluate(body => body.innerHTML, bodyHandle);
        
        console.log('--- [4] فحص محتوى الصفحة داخلياً ---');
        if (html.includes('category-block')) {
            console.log('✅ تم العثور على الكود المصدري لكتلة التصنيفات.');
        } else {
            console.log('❌ لم يتم العثور على category-block. ربما الحماية تمنع الرؤية.');
            // حفظ لقطة شاشة لرؤية ما يراه البوت (مفيد جداً للفحص في GitHub Actions)
            await page.screenshot({ path: 'debug_screen.png' });
        }

        // محاولة استخراج البيانات بناءً على الهيكل الذي أرسلته
        const channels = await page.evaluate((base) => {
            const results = [];
            const blocks = document.querySelectorAll('.category-block[data-category="ام بي سي"] .stream-box');
            
            blocks.forEach(el => {
                results.push({
                    title: el.querySelector('.stream-title')?.innerText.trim(),
                    pageUrl: base + el.getAttribute('href'),
                    logo: base + el.querySelector('img')?.getAttribute('src')
                });
            });
            return results;
        }, baseUrl);

        console.log(`--- [5] النتيجة: تم العثور على ${channels.length} قناة ---`);

        if (channels.length > 0) {
            console.log('--- [6] الدخول لأول قناة كعينة فحص... ---');
            await page.goto(channels[0].pageUrl, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 10000));
            
            const iframeSrc = await page.$eval('.iframevideo', el => el.getAttribute('src')).catch(() => 'لم يتم العثور على iframe');
            console.log(`عينة من رابط المشغل للقناة الأولى: ${iframeSrc}`);
        }

        // حفظ ملف النتائج
        fs.writeFileSync('channels.json', JSON.stringify({ 
            count: channels.length, 
            status: channels.length > 0 ? "Success" : "Failed",
            data: channels 
        }, null, 2));

    } catch (error) {
        console.error('🔴 خطأ تقني:', error.message);
    } finally {
        await browser.close();
        console.log('--- [7] إغلاق المتصفح ---');
    }
}

startScraping();
