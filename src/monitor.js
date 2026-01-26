import { chromium } from "playwright"

import {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  TELEGRAM_THREAD_ID,
  TELEGRAM_CHAT_ID2,
  CITY,
  STREET,
  HOUSE,
  SHUTDOWNS_PAGE,
} from "./constants.js"

import {
  capitalize, 
  loadLastMessageMap, 
  saveLastMessageMap,
} from "./helpers.js"

async function getInfo() {
  console.log("🌀 Getting info...")

  const browser = await chromium.launch({ headless: true })
  const browserPage = await browser.newPage()

  
  try {
    await browserPage.goto(SHUTDOWNS_PAGE, {
      waitUntil: "load",
    })

    const csrfTokenTag = await browserPage.waitForSelector(
      'meta[name="csrf-token"]',
      { state: "attached" }
    )
    const csrfToken = await csrfTokenTag.getAttribute("content")

    const info = await browserPage.evaluate(
      async ({ CITY, STREET, csrfToken }) => {
        const formData = new URLSearchParams()
        formData.append("method", "getHomeNum")
        formData.append("data[0][name]", "city")
        formData.append("data[0][value]", CITY)
        formData.append("data[1][name]", "street")
        formData.append("data[1][value]", STREET)
        formData.append("data[2][name]", "updateFact")
        formData.append("data[2][value]", new Date().toLocaleString("uk-UA"))

        const response = await fetch("/ua/ajax", {
          method: "POST",
          headers: {
            "x-requested-with": "XMLHttpRequest",
            "x-csrf-token": csrfToken,
          },
          body: formData,
        })
        return await response.json()
      },
      { CITY, STREET, csrfToken }
    )

    console.log("✅ Getting info finished.")
    return info
  } catch (error) {
    throw Error(`❌ Getting info failed: ${error.message}`)
  } finally {
    await browser.close()
  }
}

function checkIsOutage(info) {
  console.log("🌀 Checking power outage...")

  if (!info?.data) {
    throw Error("❌ Power outage info missed.")
  }

  const { sub_type, start_date, end_date, type } = info?.data?.[HOUSE] || {}
  const isOutageDetected =
    sub_type !== "" || start_date !== "" || end_date !== "" || type !== ""

  isOutageDetected
    ? console.log("🚨 Power outage detected!")
    : console.log("⚡️ No power outage!")

  return isOutageDetected
}

function checkIsScheduled(info) {
  console.log("🌀 Checking whether power outage scheduled...")

  if (!info?.data) {
    throw Error("❌ Power outage info missed.")
  }

  const { sub_type } = info?.data?.[HOUSE] || {}
  const isScheduled =
    !sub_type.toLowerCase().includes("авар") &&
    !sub_type.toLowerCase().includes("екст")

  isScheduled
    ? console.log("🗓️ Power outage scheduled!")
    : console.log("⚠️ Power outage not scheduled!")

  return isScheduled
}

function generateMessage(info) {
  console.log("🌀 Generating message...")

  const { sub_type, start_date, end_date } = info?.data?.[HOUSE] || {}
  const { updateTimestamp } = info || {}

  const reason = capitalize(sub_type).replace(/екстренні/gi, "Екстрені")
  const [beginTime, beginDate] = start_date.split(" ")
  const [endTime, endDate] = end_date.split(" ")
  const period = `${beginTime} ${beginDate} — ${endTime} ${endDate}`
  const text = [
    "🚨🚨 <b>Екстрене відключення:</b>",
    `<blockquote><code>🌑 ${beginTime} ${beginDate}\n🌕 ${endTime} ${endDate}</code></blockquote>`,
    "",
    `⚠️ <b>Причина: </b><i>${reason}.</i>`,
    "",
    `‼️ <b>Терміни орієнтовні</b>`,
    `🔄 <b>Оновлено: </b> <i>${updateTimestamp}</i>`,
    `🔗 <b>Джерело: </b><a href="https://www.dtek-kem.com.ua/ua/shutdowns">ДТЕК КЕМ</a>`
  ].join("\n")
  
  return { text, period }
}

function isQuietHoursKyiv() {
  const now = new Date()

  const hh = Number(now.toLocaleString("en-US", { timeZone: "Europe/Kyiv", hour: "2-digit", hour12: false }).trim())
  const mm = Number(now.toLocaleString("en-US", { timeZone: "Europe/Kyiv", minute: "2-digit" }).trim())


  const minutes = hh * 60 + mm
  return minutes >= 0 && minutes < 390 // 00:00..06:29 (06:30 = 390 вже НЕ тихо)
}

async function sendMessage({ chat_id, thread_id, text, disable_notification }) {
  const payload = {
    chat_id,
    text,
    parse_mode: "HTML",
    disable_notification,
  }

  if (thread_id) payload.message_thread_id = Number(thread_id)

  const resp = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )

  const data = await resp.json()
  if (!resp.ok || data.ok === false) {
    throw Error(`Telegram API error: ${data.description || resp.status}`)
  }
  return data.result
}


async function sendNotification(text, period) {
  if (!TELEGRAM_BOT_TOKEN) throw Error("❌ Missing telegram bot token.")
  if (!TELEGRAM_CHAT_ID) throw Error("❌ Missing telegram chat id.")

  const lastMessage = loadLastMessage() || {}

  // ✅ якщо період не змінився — нічого не робимо
  if (lastMessage.period === period) {
    console.log("🟡 Period unchanged. Skip sending.")
    return
  }

  console.log("🌀 Sending notification...")

  const disable_notification = isQuietHoursKyiv()
  
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_notification,
        }),
      }
    )

    const data = await response.json()
    if (!response.ok || data.ok === false) {
      throw Error(`Telegram API error: ${data.description || response.status}`)
    }
    
    saveLastMessage({
      message_id: data.result.message_id,
      date: data.result.date,
      text,
      period,
    })

  
    console.log(
      disable_notification ? "🟢 Notification sent (silent)." : "🟢 Notification sent."
    )
  } catch (error) {
    console.log("🔴 Notification not sent.", error.message)
    deleteLastMessage()
  }
}

import { loadLastMessageMap, saveLastMessageMap } from "./helpers.js"

async function run() {
  const info = await getInfo()

  if (!checkIsOutage(info)) return
  if (checkIsScheduled(info)) return

  const { text, period } = generateMessage(info)
  const key = `${CITY}|${STREET}|${HOUSE}`

  const map = loadLastMessageMap()
  const last = map[key] || {}

  if (last.period === period) {
    console.log("🟡 Unchanged period for", key, "- skip")
    return
  }

  const disable_notification = isQuietHoursKyiv()

  // 1) chat2 (основний для дедуп/історії)
  await sendMessage({
    chat_id: TELEGRAM_CHAT_ID2,
    text,
    disable_notification,
  })

  // 2) chat1 (+ thread якщо є)
  await sendMessage({
    chat_id: TELEGRAM_CHAT_ID,
    thread_id: TELEGRAM_THREAD_ID || null,
    text,
    disable_notification,
  })

  map[key] = { period, updated_at: new Date().toISOString() }
  saveLastMessageMap(map)

  console.log("🟢 Sent to both chats. Saved state for", key)
}


run().catch((error) => console.error(error.message))
