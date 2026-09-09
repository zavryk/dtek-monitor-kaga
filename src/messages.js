import { providerOf } from "./providers.js"

function capitalize(value) {
  if (typeof value !== "string" || value === "") return ""
  return value[0].toUpperCase() + value.slice(1).toLowerCase()
}

// Формат лишається той самий, що був: люди його вже впізнають, і міняти
// його заразом із перебудовою коду означало б змішати дві різні зміни.
export function outageMessage(target, record, updateTimestamp) {
  const { label, page } = providerOf(target)
  const [beginTime, beginDate] = String(record.start_date).split(" ")
  const [endTime, endDate] = String(record.end_date).split(" ")
  const reason = capitalize(record.sub_type).replace(/екстренні/gi, "Екстрені")

  return [
    "🚨🚨 <b>Екстрене відключення:</b>",
    "",
    `📍 <b><u>${target.street}</u></b>`,
    `<blockquote><code>🌑 ${beginTime} ${beginDate}\n🌕 ${endTime} ${endDate}</code></blockquote>`,
    "",
    `⚠️ <b>Причина: </b><i>${reason}.</i>`,
    "",
    "‼️ <b>Терміни орієнтовні</b>",
    `🔄 <b>Оновлено: </b> <i>${updateTimestamp || ""}</i>`,
    `🔗 <b>Джерело: </b><a href="${page}">${label}</a>`,
  ].join("\n")
}

export function periodOf(record) {
  return `${record.start_date} — ${record.end_date}`
}

// Повідомлення про поломку самого монітора. Йде в окремий чат і лише на
// зміну стану: підряд однакові скарги перестають читати, і справжня
// поломка тоне серед власних повторів.
export function failureMessage(target, streak, error) {
  return [
    `🛠 <b>Монітор не бачить даних</b>`,
    `📍 ${target.city}, ${target.street}, ${target.house}`,
    `Спроб поспіль: <b>${streak}</b>`,
    `<code>${String(error).slice(0, 300)}</code>`,
  ].join("\n")
}

export function recoveryMessage(target, streak, minutes) {
  return [
    `✅ <b>Монітор знову бачить дані</b>`,
    `📍 ${target.city}, ${target.street}, ${target.house}`,
    `Не працювало: <b>${minutes} хв</b>, спроб: <b>${streak}</b>`,
  ].join("\n")
}
