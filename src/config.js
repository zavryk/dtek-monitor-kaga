import fs from "node:fs"
import path from "node:path"

// Адреси -- не секрет, тому лежать у репозиторії й читаються як код.
// Секрет тут один: токен бота. Раніше адреси приходили через inputs
// workflow_dispatch, і кожна нова означала ще один systemd-таймер на
// сервері; тепер їх стільки, скільки рядків у цьому файлі.
export const CONFIG_FILE = path.resolve("config.json")
export const STATE_FILE = path.resolve("artifacts", "state.json")

export const { TELEGRAM_BOT_TOKEN, TELEGRAM_ALERT_CHAT_ID } = process.env

// Скільки поспіль невдалих спроб має статися, перш ніж бот скаржиться.
// Одна помилка -- це мережа, три поспіль (пів години) -- це поломка.
export const FAIL_ALERT_AFTER = Number(process.env.FAIL_ALERT_AFTER || 3)

// Тиха доба: повідомлення надходять без звуку.
export const QUIET_FROM_MINUTES = 0
export const QUIET_TO_MINUTES = 6 * 60 + 30

export function loadTargets() {
  const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"))
  const targets = raw?.targets
  if (!Array.isArray(targets) || targets.length === 0) {
    throw Error("config.json: порожній або відсутній масив targets")
  }
  for (const target of targets) {
    for (const field of ["id", "provider", "city", "street", "house"]) {
      if (!target[field]) throw Error(`config.json: ціль без поля ${field}`)
    }
    if (!Array.isArray(target.chats) || target.chats.length === 0) {
      throw Error(`config.json: ціль ${target.id} без чатів`)
    }
  }
  return targets
}
