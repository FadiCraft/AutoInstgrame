const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function startScraping() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const baseUrl = 'https://www.yallatv.online';
    const finalChannels = [];

    try {
        console.log('--- بدأت عملية الفحص التفصيلي ---');
        
        // 1. الدخول للصفحة الرئيسية لقنوات MBC
        await page.goto(`${baseUrl}/?m=tv&cat=%D8%A7%D9%85+%D8%A8%D9%8A+%D8%B3%D9%8A`, {
            waitUntil: 'networkidle2'
        });

        // 2. استخراج كافة القنوات من الهيكل الذي أرسلته
        const channelsData = await page.$$eval('.category-block[data-category="ام بي سي"] .stream-box', (elements, base) => {
            return elements.map(el => ({
                title: el.querySelector('.stream-title')?.innerText.trim(),
                pageUrl: base + el.getAttribute('href'),
                logo: base + el.querySelector('img')?.getAttribute('src')
            }));
        }, baseUrl);

        console.log(`تم العثور على ${channelsData.length} قناة. جاري استخراج روابط المشغلات...`);

        // 3. الدخول لكل قناة لاستخراج رابط الـ iframe والمشغل
        for (let i = 0; i < channelsData.length; i++) {
            const channel = channelsData[i];
            try {
                console.log(`فحص قناة (${i + 1}/${channelsData.length}): ${channel.title}`);
                
                await page.goto(channel.pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });

                // استخراج رابط الـ iframe من داخل الهيكل
                const iframeSrc = await page.$eval('.iframevideo', el => el.getAttribute('src')).catch(() => null);

                if (iframeSrc) {
                    // بناء الرابط الكامل للمشغل
                    const fullPlayerUrl = iframeSrc.startsWith('http') ? iframeSrc : baseUrl + iframeSrc;
                    
                    // الآن سنقوم باعتراض طلبات الشبكة أثناء تحميل الـ iframe للحصول على الـ m3u8 الحقيقي
                    let m3u8Url = null;
                    const client = await page.target().createCDPSession();
                    await client.send('Network.enable');
                    
                    page.on('request', request => {
                        if (request.url().includes('.m3u8')) {
                            m3u8Url = request.url();
                        }
                    });

                    // الانتظار قليلاً ليعمل المشغل ويظهر رابط البث
                    await new Promise(r => setTimeout(r, 5000));

                    finalChannels.push({
                        name: channel.title,
                        logo: channel.logo,
                        player_page: channel.pageUrl,
                        iframe_link: fullPlayerUrl,
                        m3u8_stream: m3u8Url // قد يكون null إذا كانت الحماية تمنع الظهور المباشر
                    });
                }
            } catch (err) {
                console.error(`فشل فحص القناة ${channel.title}:`, err.message);
            }
        }

        // 4. حفظ البيانات بشكل منظم جداً
        const output = {
            developer: "Fadi Alatawna",
            last_sync: new Date().toLocaleString('ar-EG'),
            source: baseUrl,
            data: finalChannels
        };

        fs.writeFileSync('channels.json', JSON.stringify(output, null, 2));
        console.log('--- اكتملت المهمة بنجاح وتم تحديث channels.json ---');

    } catch (error) {
        console.error('خطأ عام في السكربت:', error);
    } finally {
        await browser.close();
    }
}

startScraping();
