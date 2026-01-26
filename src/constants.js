import path from "node:path"

export const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_THREAD_ID, TELEGRAM_CHAT_ID2, STREET, HOUSE, CITY } =
  process.env

export const SHUTDOWNS_PAGE = "https://www.dtek-krem.com.ua/ua/shutdowns"

export const LAST_MESSAGE_FILE = path.resolve("artifacts", `last-message.json`)
