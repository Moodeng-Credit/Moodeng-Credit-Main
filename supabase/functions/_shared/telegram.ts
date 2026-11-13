// A button opens a link (url), calls back into telegram-webhook (callback_data, ≤64 bytes), or copies
// text to the tapper's clipboard (copy_text, ≤256 characters).
export type TelegramButton =
   | { text: string; url: string }
   | { text: string; callback_data: string }
   | { text: string; copy_text: { text: string } }
   // Telegram Login: opens the URL with signed auth data for whoever tapped (domain set in BotFather).
   | { text: string; login_url: { url: string; request_write_access?: boolean } };
export type TelegramInlineKeyboard = Array<Array<TelegramButton>>;

type TelegramApiResult<T> = {
   ok: boolean;
   result?: T;
   description?: string;
};

const getTelegramToken = () => Deno.env.get('TELEGRAM_API_TOKEN') ?? Deno.env.get('TELEGRAM_BOT_TOKEN');

export const callTelegramApi = async <T = unknown>(method: string, payload: Record<string, unknown>) => {
   const telegramApiUrl = Deno.env.get('TELEGRAM_API_URL');
   const telegramToken = getTelegramToken();
   const url =
      method === 'sendMessage' && telegramApiUrl
         ? telegramApiUrl
         : telegramToken
           ? `https://api.telegram.org/bot${telegramToken}/${method}`
           : null;

   if (!url) {
      throw new Error('TELEGRAM_API_TOKEN is not configured.');
   }

   const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
   });

   const result = (await response.json().catch(() => null)) as TelegramApiResult<T> | null;
   if (!response.ok || !result?.ok) {
      throw new Error(result?.description ?? `Telegram ${method} failed with ${response.status}`);
   }

   return result.result as T;
};

export const sendTelegramMessage = async (
   chatId: number | string,
   text: string,
   options: { inlineKeyboard?: TelegramInlineKeyboard; messageThreadId?: number; replyToMessageId?: number } = {}
) => {
   return callTelegramApi('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(options.messageThreadId ? { message_thread_id: options.messageThreadId } : {}),
      // allow_sending_without_reply: still post if the card was deleted.
      ...(options.replyToMessageId ? { reply_to_message_id: options.replyToMessageId, allow_sending_without_reply: true } : {}),
      ...(options.inlineKeyboard ? { reply_markup: { inline_keyboard: options.inlineKeyboard } } : {})
   });
};

export type TelegramUpload = { name: string; mime: string; bytes: Uint8Array<ArrayBuffer> };

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Uploads files into a chat so they open inside Telegram: photos as an album (≤10 each), anything
 * else (PDF, HEIC…) as documents. A photo Telegram refuses (too big, odd shape) goes again as a
 * document. Returns how many were posted; never throws.
 */
export const sendTelegramFiles = async (chatId: number | string, files: TelegramUpload[], options: { replyToMessageId?: number } = {}) => {
   const token = getTelegramToken();
   if (!token || !files.length) return 0;
   const post = async (method: string, kind: 'photo' | 'document', group: TelegramUpload[]) => {
      const form = new FormData();
      form.append('chat_id', String(chatId));
      if (options.replyToMessageId) {
         form.append('reply_parameters', JSON.stringify({ message_id: options.replyToMessageId, allow_sending_without_reply: true }));
      }
      if (method === 'sendMediaGroup') {
         group.forEach((f, i) => form.append(`f${i}`, new Blob([f.bytes], { type: f.mime }), f.name));
         form.append('media', JSON.stringify(group.map((_, i) => ({ type: kind, media: `attach://f${i}` }))));
      } else {
         form.append(kind, new Blob([group[0].bytes], { type: group[0].mime }), group[0].name);
      }
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: form });
      const json = (await res.json().catch(() => null)) as TelegramApiResult<unknown> | null;
      if (!res.ok || !json?.ok) throw new Error(json?.description ?? `Telegram ${method} failed with ${res.status}`);
   };
   const send = async (kind: 'photo' | 'document', list: TelegramUpload[]): Promise<number> => {
      let sent = 0;
      for (let i = 0; i < list.length; i += 10) {
         const group = list.slice(i, i + 10);
         try {
            await post(group.length > 1 ? 'sendMediaGroup' : kind === 'photo' ? 'sendPhoto' : 'sendDocument', kind, group);
            sent += group.length;
         } catch (err) {
            console.warn(`telegram ${kind} upload failed`, err instanceof Error ? err.message : err);
            if (kind === 'photo') sent += await send('document', group);
         }
      }
      return sent;
   };
   const photos = files.filter((f) => PHOTO_TYPES.has(f.mime) && f.bytes.byteLength <= 10_000_000);
   const others = files.filter((f) => !photos.includes(f) && f.bytes.byteLength <= 50_000_000);
   return (await send('photo', photos)) + (await send('document', others));
};

export type TelegramForumTopic = {
   message_thread_id: number;
   name: string;
};

export const createTelegramForumTopic = async (chatId: number | string, name: string) => {
   return callTelegramApi<TelegramForumTopic>('createForumTopic', {
      chat_id: chatId,
      name
   });
};

export const closeTelegramForumTopic = async (chatId: number | string, messageThreadId: number) => {
   return callTelegramApi('closeForumTopic', {
      chat_id: chatId,
      message_thread_id: messageThreadId
   });
};
