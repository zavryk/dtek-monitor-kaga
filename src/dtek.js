import { chromium } from "playwright"

import { providerOf } from "./providers.js"

// Сайти ДТЕК стоять за Imperva: звичайний HTTP-клієнт отримує 212 байт
// JS-заглушки замість сторінки (перевірено 10.09.2026). Тому справжній
// браузер тут не примха, а єдиний спосіб узагалі дістати дані -- і
// заразом причина, чому це живе на GitHub Actions, а не на нашому VPS
// з його 1.9 ГБ пам'яті.
//
// Один браузер на весь прогін, по сторінці на провайдера: запуск
// Chromium коштує в рази більше, ніж сам запит, а провайдерів два.
export async function withBrowser(fn) {
  const browser = await chromium.launch({ headless: true })
  try {
    return await fn(browser)
  } finally {
    await browser.close()
  }
}

export async function fetchStreetInfo(browser, target) {
  const { page: url, needsCity } = providerOf(target)

  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60_000 })

    const tag = await page.waitForSelector('meta[name="csrf-token"]', {
      state: "attached",
      timeout: 30_000,
    })
    const csrfToken = await tag.getAttribute("content")

    // Запит виконується всередині сторінки, а не з Node: так він несе
    // куки, які Imperva видала браузеру, і той самий Origin.
    return await page.evaluate(
      async ({ city, street, csrfToken, needsCity }) => {
        const form = new URLSearchParams()
        form.append("method", "getHomeNum")
        // Область питає місто й вулицю, місто Київ -- саму вулицю.
        if (needsCity) {
          form.append("data[0][name]", "city")
          form.append("data[0][value]", city)
        }
        form.append("data[1][name]", "street")
        form.append("data[1][value]", street)
        form.append("data[2][name]", "updateFact")
        form.append("data[2][value]", new Date().toLocaleString("uk-UA"))

        const response = await fetch("/ua/ajax", {
          method: "POST",
          headers: {
            "x-requested-with": "XMLHttpRequest",
            "x-csrf-token": csrfToken,
          },
          body: form,
        })
        if (!response.ok) throw Error(`HTTP ${response.status}`)
        return await response.json()
      },
      { city: target.city, street: target.street, csrfToken, needsCity }
    )
  } finally {
    await page.close()
  }
}

// Три різні відповіді, які раніше зливались в одну.
//
//   missing  -- будинку немає у відповіді. Стара версія читала це як
//               "є відключення" (undefined !== ""), потім падала на
//               undefined.toLowerCase() -- і мовчки, бо помилка не
//               доходила до коду виходу. Тепер це окремий стан: адреса
//               в конфігу розійшлася з довідником ДТЕК.
//   none     -- будинок є, полів немає: світло за планом.
//   outage   -- є запис; emergency каже, аварійне воно чи планове.
export function readHouse(info, target) {
  if (!info || typeof info.data !== "object" || info.data === null) {
    throw Error("Відповідь без поля data")
  }

  const record = info.data[target.house]
  if (record === undefined) {
    return { kind: "missing" }
  }

  const { sub_type = "", start_date = "", end_date = "", type = "" } = record
  const hasOutage = [sub_type, start_date, end_date, type].some((v) => v !== "")
  if (!hasOutage) return { kind: "none" }

  const marker = String(sub_type).toLowerCase()
  const emergency = marker.includes("авар") || marker.includes("екст")
  return {
    kind: "outage",
    emergency,
    record: { sub_type, start_date, end_date, type },
  }
}
