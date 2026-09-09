import {
  FAIL_ALERT_AFTER,
  TELEGRAM_ALERT_CHAT_ID,
  loadTargets,
} from "./config.js"
import { fetchStreetInfo, readHouse, withBrowser } from "./dtek.js"
import {
  failureMessage,
  outageMessage,
  periodOf,
  recoveryMessage,
} from "./messages.js"
import { loadState, saveState, targetState } from "./state.js"
import { isQuietHoursKyiv, sendMessage } from "./telegram.js"

async function alert(text) {
  if (!TELEGRAM_ALERT_CHAT_ID) return
  try {
    await sendMessage({ chat_id: TELEGRAM_ALERT_CHAT_ID, text, silent: true })
  } catch (error) {
    // Скарга на поломку, яка сама впала, не має ламати прогін: дані
    // важливіші за розповідь про них.
    console.error("Не вдалось надіслати службове повідомлення:", error.message)
  }
}

async function notifyOutage(target, record, updateTimestamp) {
  const text = outageMessage(target, record, updateTimestamp)
  const silent = isQuietHoursKyiv()
  for (const chat of target.chats) {
    await sendMessage({
      chat_id: chat.chat_id,
      thread_id: chat.thread_id,
      text,
      silent,
    })
  }
}

async function handleTarget(browser, target, state) {
  const previous = targetState(state, target.id)
  const info = await fetchStreetInfo(browser, target)
  const house = readHouse(info, target)

  if (house.kind === "missing") {
    // Не відключення й не збій мережі, а розбіжність конфігу з
    // довідником. Кидаємо як помилку цілі -- її видно і в коді виходу,
    // і в одному службовому повідомленні.
    throw Error(
      `Будинок "${target.house}" відсутній на ${target.street}: ` +
        `є ${Object.keys(info.data).slice(0, 12).join(", ") || "нічого"}`
    )
  }

  if (house.kind === "outage" && house.emergency) {
    const period = periodOf(house.record)
    if (previous.period === period) {
      console.log(`🟡 ${target.id}: період не змінився`)
    } else {
      await notifyOutage(target, house.record, info.updateTimestamp)
      console.log(`🚨 ${target.id}: надіслано, ${period}`)
    }
    return { period, updated_at: new Date().toISOString() }
  }

  // Планове відключення або його відсутність. Повідомлення про
  // завершення навмисно немає: заживлення однаково триває невідомо
  // скільки, і "завершилось" о 23:35 читалось як обіцянка.
  if (previous.period) console.log(`⚪ ${target.id}: аварійного немає`)
  return { period: null, updated_at: new Date().toISOString() }
}

async function run() {
  const targets = loadTargets()
  const state = loadState()
  let failures = 0

  await withBrowser(async (browser) => {
    for (const target of targets) {
      const previous = targetState(state, target.id)
      try {
        const next = await handleTarget(browser, target, state)

        if (previous.fail_streak >= FAIL_ALERT_AFTER) {
          const minutes = Math.round(
            (Date.now() - new Date(previous.failing_since).getTime()) / 60000
          )
          await alert(recoveryMessage(target, previous.fail_streak, minutes))
        }
        state[target.id] = { ...next, fail_streak: 0, failing_since: null }
      } catch (error) {
        failures += 1
        const streak = (previous.fail_streak || 0) + 1
        const failing_since = previous.failing_since || new Date().toISOString()
        console.error(`❌ ${target.id}: ${error.message}`)

        // Одна скарга на перехід, а не на кожну спробу. Одна невдача --
        // це мережа; FAIL_ALERT_AFTER поспіль -- це поломка, про яку
        // варто знати.
        if (streak === FAIL_ALERT_AFTER) {
          await alert(failureMessage(target, streak, error.message))
        }
        state[target.id] = { ...previous, fail_streak: streak, failing_since }
      }
    }
  })

  saveState(state)

  if (failures > 0) {
    // Червоний прогін -- це те, що GitHub уміє показати сам: у списку
    // Actions і листом. Стара версія ковтала помилку в catch і завжди
    // виходила нулем, тож зламаний монітор виглядав здоровим.
    process.exitCode = 1
    console.error(`Цілей із помилкою: ${failures} з ${targets.length}`)
  }
}

run().catch((error) => {
  console.error("Фатально:", error.message)
  process.exitCode = 1
})
