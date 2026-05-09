const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function scrapeAflam4You() {
    console.log('--- [1] تشغيل المتصفح لفحص موقع Aflam4You ---');
    
    const browser = await puppeteer.launch({
        headless: "new", // غيرها إلى false إذا أردت تشغيله محلياً ورؤية ما يحدث
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--window-size=1280,720',
            '--disable-web-security'
        ]
    });

    const baseUrl = 'https://new.aflam4you.net';
    
    // ضع هنا الرابط الذي يحتوي على قائمة القنوات (الصفحة الرئيسية أو تصنيف معين)
    const targetCategoryUrl = 'https://new.aflam4you.net/'; 
    
    const finalData = [];

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        console.log(`--- [2] الدخول إلى صفحة القنوات: ${targetCategoryUrl} ---`);
        await page.goto(targetCategoryUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // استخراج بيانات القنوات بناءً على الهيكل الذي قدمته
        const channels = await page.evaluate((base) => {
            const results = [];
            // البحث عن كل كتلة تحتوي على قناة
            const items = document.querySelectorAll('.thumbnail');

            items.forEach(el => {
                const linkEl = el.querySelector('.pm-video-thumb a');
                const imgEl = el.querySelector('.pm-video-thumb img');
                const titleEl = el.querySelector('.caption h3 a');

                if (linkEl && titleEl) {
                    const path = linkEl.getAttribute('href');
                    const imgPath = imgEl ? imgEl.getAttribute('src') : null;

                    results.push({
                        title: titleEl.innerText.trim(),
                        pageUrl: path.startsWith('http') ? path : base + path,
                        logo: imgPath ? (imgPath.startsWith('http') ? imgPath : base + imgPath) : null
                    });
                }
            });
            return results;
        }, baseUrl);

        console.log(`--- [3] تم العثور على ${channels.length} قناة. جاري الدخول لاستخراج الروابط... ---`);

        // المرور على كل قناة واستخراج الـ iframe والـ m3u8
        for (let i = 0; i < channels.length; i++) {
            const channel = channels[i];
            console.log(`فحص (${i + 1}/${channels.length}): ${channel.title}`);

            const channelPage = await browser.newPage();
            let m3u8Url = null;

            // تفعيل اعتراض طلبات الشبكة لاصطياد رابط البث
            await channelPage.setRequestInterception(true);
            channelPage.on('request', request => {
                if (request.url().includes('.m3u8')) {
                    m3u8Url = request.url();
                    console.log(`   🎯 تم اصطياد الرابط: ${m3u8Url.split('?')[0]}...`);
                }
                request.continue();
            });

            try {
                // الدخول لصفحة القناة
                await channelPage.goto(channel.pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // استخراج رابط الـ iframe من الـ div صاحب الـ id="Playerholder"
                const iframeSrc = await channelPage.$eval('#Playerholder iframe', el => el.getAttribute('src')).catch(() => null);
                let fullIframeUrl = null;

                if (iframeSrc) {
                    // تحويل الرابط النسبي (مثل /zremb472.php?...) إلى رابط كامل
                    fullIframeUrl = iframeSrc.startsWith('http') ? iframeSrc : baseUrl + iframeSrc;
                    
                    // انتظار 4 ثوانٍ لضمان تحميل المشغل وإرساله لطلب الـ m3u8 في الشبكة
                    await new Promise(r => setTimeout(r, 4000));
                }

                finalData.push({
                    name: channel.title,
                    logo: channel.logo,
                    iframe_link: fullIframeUrl,
                    m3u8_stream: m3u8Url
                });

            } catch (err) {
                console.log(`   ❌ فشل تحميل المشغل لقناة ${channel.title}`);
            } finally {
                await channelPage.close();
            }
        }

        // حفظ البيانات النهائية في ملف
        fs.writeFileSync('aflam4you_channels.json', JSON.stringify({
            developer: "Fadi Alatawna",
            updated_at: new Date().toISOString(),
            total_channels: finalData.length,
            channels: finalData
        }, null, 2));

        console.log('--- [4] تمت العملية بنجاح! تم حفظ البيانات في aflam4you_channels.json ---');

    } catch (error) {
        console.error('🔴 خطأ تقني:', error.message);
    } finally {
        await browser.close();
        console.log('--- تم إغلاق المتصفح ---');
    }
}

scrapeAflam4You();
