export type TelegramInlineKeyboard = Array<Array<{ text: string; url: string }>>;

type TelegramApiResult<T> = {
   ok: boolean;
   result?: T;
   description?: string;
};

const getTelegramToken = (tokenOverride?: string | null) =>
   tokenOverride?.trim() || Deno.env.get('TELEGRAM_API_TOKEN') || Deno.env.get('TELEGRAM_BOT_TOKEN');

export const callTelegramApi = async <T = unknown>(
   method: string,
   payload: Record<string, unknown>,
   options: { token?: string | null } = {}
) => {
   const telegramToken = getTelegramToken(options.token);
   const telegramApiUrl = options.token ? null : Deno.env.get('TELEGRAM_API_URL');
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
   options: { inlineKeyboard?: TelegramInlineKeyboard; messageThreadId?: number; token?: string | null } = {}
) => {
   return callTelegramApi(
      'sendMessage',
      {
         chat_id: chatId,
         text,
         disable_web_page_preview: true,
         ...(options.messageThreadId ? { message_thread_id: options.messageThreadId } : {}),
         ...(options.inlineKeyboard ? { reply_markup: { inline_keyboard: options.inlineKeyboard } } : {})
      },
      { token: options.token }
   );
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
