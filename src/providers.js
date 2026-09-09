// Два обленерго з однаковим рушієм сайту й різними доменами.
//
// КРЕМ -- Київські РЕГІОНАЛЬНІ електромережі (область), КЕМ -- місто
// Київ. Різниця тільки в домені й підписі під повідомленням, тому
// тримати заради неї три окремі репозиторії не було потреби: саме це
// й розвело їх у три форки, кожен зі своїми виправленнями.
// needsCity -- не косметика: форма пошуку в них різна. Область питає
// місто й вулицю (data[0] = city), місто Київ -- лише вулицю, бо місто
// в ньому й так одне. Саме через це три форки не можна було просто
// злити: той самий запит на іншому домені повертає порожнечу.
export const PROVIDERS = {
  krem: {
    page: "https://www.dtek-krem.com.ua/ua/shutdowns",
    label: "ДТЕК КРЕМ",
    needsCity: true,
  },
  kem: {
    page: "https://www.dtek-kem.com.ua/ua/shutdowns",
    label: "ДТЕК КЕМ",
    needsCity: false,
  },
}

export function providerOf(target) {
  const provider = PROVIDERS[target.provider]
  if (!provider) {
    throw Error(`Невідомий провайдер "${target.provider}" у цілі ${target.id}`)
  }
  return provider
}
