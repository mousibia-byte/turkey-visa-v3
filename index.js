require('dotenv').config();
const express = require('express');
const VisaBot = require('./bot');
const { scrapeVisaSlots } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !ADMIN_ID || !CHANNEL_ID) {
    console.error('❌ Missing environment variables. Please check TELEGRAM_TOKEN, ADMIN_ID, and CHANNEL_ID.');
    process.exit(1);
}

// Health Check Server
app.get('/', (req, res) => {
    res.status(200).send('Turkey Visa Monitor is Live 🚀');
});

// Bind to 0.0.0.0 for Render
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 Health check server listening on port ${PORT}`);

    // Initialize Bot after server is up
    const bot = new VisaBot(TOKEN, ADMIN_ID, CHANNEL_ID);

    const monitors = [
        { city: 'Oran', url: 'https://appointment.mosaicvisa.com/calendar/7' },
        { city: 'Algiers', url: 'https://appointment.mosaicvisa.com/calendar/9' }
    ];

    const previousCounts = {
        'Oran': { available: -1, reserved: -1 },
        'Algiers': { available: -1, reserved: -1 }
    };

    async function checkAppointments() {
        if (!bot.isRunning) return;

        console.log(`--- Starting Check: ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Algiers' })} ---`);
        for (const monitor of monitors) {
            // Check if city monitoring is active
            if (!bot.cityStatus[monitor.city]) {
                console.log(`Skipping ${monitor.city} as it is disabled.`);
                continue;
            }

            try {
                const { available, reserved } = await scrapeVisaSlots(monitor.url);
                const prev = previousCounts[monitor.city];

                if (available !== prev.available || reserved !== prev.reserved) {
                    await bot.sendAdminAlert(monitor.city, available, reserved);
                    previousCounts[monitor.city] = { available, reserved };
                }
                bot.updateLastResults(monitor.city, available, reserved);
            } catch (error) {
                console.error(`Error in loop for ${monitor.city}:`, error.message);
            }
        }
    }

    // Start the loop every 2 minutes
    setInterval(checkAppointments, 2 * 60 * 1000);

    // Initial run after a short delay to let Render mark the service as LIVE
    setTimeout(() => {
        console.log("🚀 Starting initial scrape...");
        checkAppointments();
    }, 10000);
});
