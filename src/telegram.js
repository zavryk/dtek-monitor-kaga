import { TELEGRAM_BOT_TOKEN, QUIET_FROM_MINUTES, QUIET_TO_MINUTES } from "./config.js"

// Тиха доба: вночі повідомлення приходять без звуку. Відключення о 03:00
// однаково варте повідомлення -- але не варте того, щоб будити.
export function isQuietHoursKyiv(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const minutes = get("hour") * 60 + get("minute")
  return minutes >= QUIET_FROM_MINUTES && minutes < QUIET_TO_MINUTES
}

export async function sendMessage({ chat_id, thread_id, text, silent }) {
  if (!TELEGRAM_BOT_TOKEN) throw Error("Немає TELEGRAM_BOT_TOKEN")

  const payload = {
    chat_id,
    text,
    parse_mode: "HTML",
    disable_notification: Boolean(silent),
    link_preview_options: { is_disabled: true },
  }
  if (thread_id) payload.message_thread_id = Number(thread_id)

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.ok === false) {
    throw Error(`Telegram: ${data.description || response.status}`)
  }
  return data.result
}
