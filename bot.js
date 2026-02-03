const TelegramBot = require('node-telegram-bot-api');
const { takeScreenshot } = require('./scraper');

class VisaBot {
    constructor(token, adminId) {
        this.bot = new TelegramBot(token, { polling: true });
        this.adminId = adminId;
        this.isRunning = true;
        this.cityStatus = {
            'Oran': true,
            'Algiers': true
        };
        this.lastResults = {
            'Oran': { available: 0, reserved: 0, lastChecked: null },
            'Algiers': { available: 0, reserved: 0, lastChecked: null }
        };

        this.setupCommands();
        this.setupCallbackQueries();
    }

    setupCommands() {
        const isAdmin = (msg) => msg.from.id.toString() === this.adminId.toString();

        // /status
        this.bot.onText(/\/status/, async (msg) => {
            if (!isAdmin(msg)) return;

            const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            let statusMsg = `📊 *تقرير حالة النظام الشخصي*\n\n`;
            statusMsg += `✅ *حالة الرصد العام:* ${this.isRunning ? 'نشط' : 'متوقف'}\n`;
            statusMsg += `🧠 *الذاكرة:* ${mem} MB\n\n`;

            statusMsg += `📍 *حالة الولايات:*\n`;
            for (const city in this.cityStatus) {
                const data = this.lastResults[city];
                const icon = this.cityStatus[city] ? '🟢' : '🔴';
                statusMsg += `${icon} *${city}:* ${data.available} متاح | ${data.reserved} محجوز\n`;
                statusMsg += `⏰ _آخر فحص: ${data.lastChecked || 'لا يوجد'}_\n\n`;
            }

            this.bot.sendMessage(msg.chat.id, statusMsg, { parse_mode: 'Markdown' });
        });

        // /stop_all & /start_all
        this.bot.onText(/\/stop_all/, (msg) => {
            if (!isAdmin(msg)) return;
            this.isRunning = false;
            this.bot.sendMessage(msg.chat.id, "🛑 تم إيقاف الرصد لجميع الولايات.");
        });

        this.bot.onText(/\/start_all/, (msg) => {
            if (!isAdmin(msg)) return;
            this.isRunning = true;
            this.cityStatus['Oran'] = true;
            this.cityStatus['Algiers'] = true;
            this.bot.sendMessage(msg.chat.id, "🚀 تم تفعيل الرصد لجميع الولايات مجدداً.");
        });

        // /screenshot
        this.bot.onText(/\/screenshot/, async (msg) => {
            if (!isAdmin(msg)) return;
            this.bot.sendMessage(msg.chat.id, "📸 جاري التقاط الصور... يرجى الانتظار.");
            const urls = { 'Oran': 'https://appointment.mosaicvisa.com/calendar/7', 'Algiers': 'https://appointment.mosaicvisa.com/calendar/9' };
            for (const [city, url] of Object.entries(urls)) {
                try {
                    const screenshot = await takeScreenshot(url);
                    await this.bot.sendPhoto(msg.chat.id, screenshot, { caption: `🖼 لقطة حية لولاية: ${city}` });
                } catch (err) {
                    this.bot.sendMessage(msg.chat.id, `❌ فشل في التقاط صورة لـ ${city}`);
                }
            }
        });
    }

    setupCallbackQueries() {
        this.bot.on('callback_query', (query) => {
            const [action, city] = query.data.split('_');
            if (action === 'stop') {
                this.cityStatus[city] = false;
                this.bot.answerCallbackQuery(query.id, { text: `🔴 تم إيقاف رصد ولابة ${city}` });
                this.bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id });
                this.bot.sendMessage(this.adminId, `⚠️ تنبيه: تم تعطيل رصد ولاية *${city}*. يمكنك تفعيل الكل عبر /start_all`, { parse_mode: 'Markdown' });
            }
        });
    }

    async sendAdminAlert(city, available, reserved) {
        if (!this.isRunning || !this.cityStatus[city]) return;

        const emoji = available > 0 ? '🔥' : '🔔';
        const message = `${emoji} *تنبيه مواعيد تركيا - ${city}*\n\n` +
            `🟢 *المتاحة:* ${available}\n` +
            `🟠 *المحجوزة:* ${reserved}\n\n` +
            `⏰ ${new Date().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Algiers' })}`;

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔗 فتح رابط الحجز", url: "https://appointment.mosaicvisa.com/" }],
                    [{ text: `🛑 إيقاف تنبيهات ${city}`, callback_data: `stop_${city}` }]
                ]
            }
        };

        try {
            await this.bot.sendMessage(this.adminId, message, options);
            if (available > 0) {
                // Triple notification sound for available slots
                await this.bot.sendMessage(this.adminId, `‼️ يوجد موعد متاح الآن في ${city.toUpperCase()}! ‼️`);
            }
        } catch (err) {
            console.error('Error sending admin alert:', err.message);
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
