const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function scrapeChannels() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const channelsList = [];

    // اعتراض طلبات الشبكة للبحث عن روابط m3u8
    page.on('request', request => {
        const url = request.url();
        if (url.includes('.m3u8')) {
            console.log('Found Stream:', url);
            channelsList.push(url);
        }
    });

    try {
        console.log('Navigating to YallaTV...');
        await page.goto('https://www.yallatv.online/?m=tv&cat=%D8%A7%D9%85+%D8%A8%D9%8A+%D8%B3%D9%8A', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // الانتظار قليلاً لتجاوز تحدي Cloudflare الأولي
        await new Promise(r => setTimeout(r, 10000));

        // استخراج أسماء القنوات وروابطها الداخلية للنقر عليها
        const links = await page.$$eval('.channel-item a', el => el.map(a => a.href));
        
        // حفظ النتائج في ملف JSON
        fs.writeFileSync('channels.json', JSON.stringify(channelsList, null, 2));
        console.log('Scraping completed. Found:', channelsList.length);

    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }
}

scrapeChannels();
