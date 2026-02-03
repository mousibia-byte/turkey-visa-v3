const TelegramBot = require('node-telegram-bot-api');
const os = require('os');
const { takeScreenshot } = require('./scraper');

class VisaBot {
    constructor(token, adminId, channelId) {
        this.bot = new TelegramBot(token, { polling: true });
        this.adminId = adminId;
        this.channelId = channelId;
        this.isRunning = true;
        this.lastResults = {
            'Oran': { available: 0, reserved: 0, lastChecked: null },
            'Algiers': { available: 0, reserved: 0, lastChecked: null }
        };

        this.setupCommands();
    }

    setupCommands() {
        const isAdmin = (msg) => msg.from.id.toString() === this.adminId.toString();

        // /status
        this.bot.onText(/\/status/, async (msg) => {
            if (!isAdmin(msg)) return this.bot.sendMessage(msg.chat.id, "❌ Not authorized.");

            const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const uptime = Math.floor(process.uptime() / 60);

            let statusMsg = `📊 *System Status Report*\n\n`;
            statusMsg += `✅ *Monitoring:* ${this.isRunning ? 'Active' : 'Stopped'}\n`;
            statusMsg += `🧠 *Memory:* ${mem} MB\n`;
            statusMsg += `⏳ *Uptime:* ${uptime} minutes\n\n`;

            statusMsg += `📍 *Last Results:*\n`;
            for (const [city, data] of Object.entries(this.lastResults)) {
                statusMsg += `🏙 *${city}:* ${data.available} Avail | ${data.reserved} Res\n`;
                statusMsg += `⏰ _Checked: ${data.lastChecked || 'Never'}_\n\n`;
            }

            this.bot.sendMessage(msg.chat.id, statusMsg, { parse_mode: 'Markdown' });
        });

        // /stop_all
        this.bot.onText(/\/stop_all/, (msg) => {
            if (!isAdmin(msg)) return this.bot.sendMessage(msg.chat.id, "❌ Not authorized.");
            this.isRunning = false;
            this.bot.sendMessage(msg.chat.id, "🛑 *Monitoring Stopped.* No more alerts will be sent to the channel.", { parse_mode: 'Markdown' });
        });

        // /start_all
        this.bot.onText(/\/start_all/, (msg) => {
            if (!isAdmin(msg)) return this.bot.sendMessage(msg.chat.id, "❌ Not authorized.");
            this.isRunning = true;
            this.bot.sendMessage(msg.chat.id, "🚀 *Monitoring Started.* System is now active.", { parse_mode: 'Markdown' });
        });

        // /screenshot
        this.bot.onText(/\/screenshot/, async (msg) => {
            if (!isAdmin(msg)) return this.bot.sendMessage(msg.chat.id, "❌ Not authorized.");
            this.bot.sendMessage(msg.chat.id, "📸 Capturing screenshots... please wait.");

            const urls = {
                'Oran': 'https://appointment.mosaicvisa.com/calendar/7',
                'Algiers': 'https://appointment.mosaicvisa.com/calendar/9'
            };

            for (const [city, url] of Object.entries(urls)) {
                try {
                    const screenshot = await takeScreenshot(url);
                    await this.bot.sendPhoto(msg.chat.id, screenshot, { caption: `🖼 Live Screenshot: ${city}\n🔗 ${url}` });
                } catch (err) {
                    this.bot.sendMessage(msg.chat.id, `❌ Failed to take screenshot for ${city}: ${err.message}`);
                }
            }
        });
    }

    async sendChannelAlert(city, available, reserved) {
        if (!this.isRunning) return;

        const message = `🔔 *Turkey Visa Alert - ${city}*\n\n` +
            `🟢 *Available:* ${available}\n` +
            `🟠 *Reserved:* ${reserved}\n\n` +
            `📅 *Time:* ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Algiers' })}\n` +
            `🔗 [Book Appointment](https://appointment.mosaicvisa.com/)`;

        try {
            await this.bot.sendMessage(this.channelId, message, { parse_mode: 'Markdown' });

            // If slots available, send high priority triple alert
            if (available > 0) {
                await this.bot.sendMessage(this.channelId, `🔥 SLOT FOUND IN ${city.toUpperCase()}! 🔥`);
                const lastMsg = await this.bot.sendMessage(this.channelId, `🏃 GO BOOK NOW! 🏃`);
                await this.bot.pinChatMessage(this.channelId, lastMsg.message_id);
            }
        } catch (err) {
            console.error('Error sending channel alert:', err.message);
        }
    }

    updateLastResults(city, available, reserved) {
        this.lastResults[city] = {
            available,
            reserved,
            lastChecked: new Date().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Algiers' })
        };
    }
}

module.exports = VisaBot;
