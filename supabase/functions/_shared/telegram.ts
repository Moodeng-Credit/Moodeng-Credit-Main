export type TelegramInlineKeyboard = Array<Array<{ text: string; url: string }>>;

export const sendTelegramMessage = async (
   chatId: number | string,
   text: string,
   options: { inlineKeyboard?: TelegramInlineKeyboard } = {}
) => {
   const telegramApiUrl = Deno.env.get('TELEGRAM_API_URL');
   const telegramToken = Deno.env.get('TELEGRAM_API_TOKEN') ?? Deno.env.get('TELEGRAM_BOT_TOKEN');
   const url = telegramApiUrl ?? (telegramToken ? `https://api.telegram.org/bot${telegramToken}/sendMessage` : null);

   if (!url) {
      throw new Error('TELEGRAM_API_TOKEN is not configured.');
   }

   const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         chat_id: chatId,
         text,
         disable_web_page_preview: true,
         ...(options.inlineKeyboard ? { reply_markup: { inline_keyboard: options.inlineKeyboard } } : {})
      })
   });

   const result = await response.json().catch(() => null);
   if (!response.ok || !result?.ok) {
      throw new Error(result?.description ?? `Telegram sendMessage failed with ${response.status}`);
   }

   return result;
};
