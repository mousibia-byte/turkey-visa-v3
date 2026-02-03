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
    res.send('Turkey Visa Monitor is running 🚀');
});

app.listen(PORT, () => {
    console.log(`📡 Health check server listening on port ${PORT}`);
});

// Initialize Bot
const bot = new VisaBot(TOKEN, ADMIN_ID, CHANNEL_ID);

const monitors = [
    { city: 'Oran', url: 'https://appointment.mosaicvisa.com/calendar/7' },
    { city: 'Algiers', url: 'https://appointment.mosaicvisa.com/calendar/9' }
];

// Anti-Duplicate State
const previousCounts = {
    'Oran': { available: -1, reserved: -1 },
    'Algiers': { available: -1, reserved: -1 }
};

async function checkAppointments() {
    console.log(`--- Starting Check: ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Algiers' })} ---`);

    for (const monitor of monitors) {
        try {
            console.log(`Checking ${monitor.city}...`);
            const { available, reserved } = await scrapeVisaSlots(monitor.url);

            console.log(`${monitor.city} Results -> Available: ${available}, Reserved: ${reserved}`);

            // Anti-Duplicate Logic: Only send alert if numbers changed
            const prev = previousCounts[monitor.city];
            if (available !== prev.available || reserved !== prev.reserved) {
                console.log(`Change detected for ${monitor.city}. Sending alert...`);
                await bot.sendChannelAlert(monitor.city, available, reserved);

                // Update state
                previousCounts[monitor.city] = { available, reserved };
            } else {
                console.log(`No change for ${monitor.city}.`);
            }

            // Update bot status for /status command
            bot.updateLastResults(monitor.city, available, reserved);

        } catch (error) {
            console.error(`Error in loop for ${monitor.city}:`, error.message);
        }
    }
    console.log(`--- Check Finished ---\n`);
}

// Start the loop (every 2 minutes to be safe and avoid rate limits/blocks)
const INTERVAL = 2 * 60 * 1000;
setInterval(checkAppointments, INTERVAL);

// Initial run
checkAppointments();
