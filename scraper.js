const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const puppeteerCore = require('puppeteer-core');

// Use puppeteer-core as the base for puppeteer-extra
puppeteer.use(StealthPlugin());

async function scrapeVisaSlots(url) {
    let browser;
    let page;
    try {
        const isWin = process.platform === 'win32';
        const defaultPath = isWin ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome';

        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || defaultPath,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        page = await browser.newPage();

        // Block unnecessary resources to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for the calendar or slots table to load
        await page.waitForFunction(() =>
            document.body.innerText.includes('Available') || document.body.innerText.includes('Reserved'),
            { timeout: 30000 }
        );

        const data = await page.evaluate(() => {
            const bodyText = document.body.innerText;

            const availableMatch = bodyText.match(/Available\s*:?\s*(\d+)/i);
            const reservedMatch = bodyText.match(/Reserved\s*:?\s*(\d+)/i);

            const getNumberFromTag = (text) => {
                const elements = Array.from(document.querySelectorAll('b, span, td, div'));
                const target = elements.find(el => el.innerText.trim().toLowerCase() === text.toLowerCase());
                if (target) {
                    const parent = target.parentElement;
                    const numbers = parent.innerText.match(/\d+/);
                    return numbers ? parseInt(numbers[0]) : 0;
                }
                return 0;
            };

            const available = availableMatch ? parseInt(availableMatch[1]) : getNumberFromTag('Available');
            const reserved = reservedMatch ? parseInt(reservedMatch[1]) : getNumberFromTag('Reserved');

            return { available, reserved };
        });

        return data;
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        throw error;
    } finally {
        if (page) await page.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

async function takeScreenshot(url) {
    let browser;
    let page;
    try {
        const isWin = process.platform === 'win32';
        const defaultPath = isWin ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome';

        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || defaultPath,
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // For screenshots, we might want CSS but can still block images to save time/space
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (req.resourceType() === 'image') {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000));

        const screenshot = await page.screenshot({ fullPage: true });
        return screenshot;
    } catch (error) {
        console.error(`Error taking screenshot for ${url}:`, error.message);
        throw error;
    } finally {
        if (page) await page.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

module.exports = { scrapeVisaSlots, takeScreenshot };
