const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeVisaSlots(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
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

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for the calendar or slots table to load
        // We'll search for text "Available" and "Reserved"
        await page.waitForFunction(() =>
            document.body.innerText.includes('Available') || document.body.innerText.includes('Reserved'),
            { timeout: 30000 }
        );

        const data = await page.evaluate(() => {
            const bodyText = document.body.innerText;

            // Regex to find numbers after "Available" and "Reserved"
            // Usually looks like "Available: 5" or "Available (5)"
            const availableMatch = bodyText.match(/Available\s*:?\s*(\d+)/i);
            const reservedMatch = bodyText.match(/Reserved\s*:?\s*(\d+)/i);

            // Alternatively, if they are in <b> tags as mentioned in some previous contexts
            const getNumberFromTag = (text) => {
                const elements = Array.from(document.querySelectorAll('b, span, td, div'));
                const target = elements.find(el => el.innerText.trim().toLowerCase() === text.toLowerCase());
                if (target) {
                    // Check next sibling or parent's child
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
        if (browser) await browser.close();
    }
}

async function takeScreenshot(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait a bit for any dynamic content
        await new Promise(r => setTimeout(r, 2000));

        const screenshot = await page.screenshot({ fullPage: true });
        return screenshot;
    } catch (error) {
        console.error(`Error taking screenshot for ${url}:`, error.message);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { scrapeVisaSlots, takeScreenshot };
