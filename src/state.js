import fs from "node:fs"
import path from "node:path"

import { STATE_FILE } from "./config.js"

// Стан живе у файлі, який workflow комітить назад у репозиторій -- це
// єдине сховище, доступне раннеру, що народжується й помирає з кожним
// прогоном. Ключ -- id цілі з config.json, а не адреса рядком: адресу
// можна виправити (кома, скорочення, "14А" -> "14-А"), і стан не має
// від цього губитися.
export function loadState() {
  if (!fs.existsSync(STATE_FILE)) return {}
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8").trim() || "{}")
  } catch {
    // Побитий файл -- не привід зупиняти моніторинг: гірше, що станеться,
    // це одне повторне повідомлення про вже відоме відключення.
    console.warn("⚠️ Стан не прочитався, починаємо з чистого")
    return {}
  }
}

export function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8")
}

export function targetState(state, id) {
  return state[id] || { period: null, fail_streak: 0, failing_since: null }
}
