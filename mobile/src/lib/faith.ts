/** Offline faith utilities: prayer times, Hijri date, Qibla bearing, zakat.
 * Pure maths, no network: they work anywhere, even with no data bundle. */

// ---------- Prayer times (standard astronomical method, as used by praytimes.org) ----------

export interface PrayerTimes {
  fajr: Date; sunrise: Date; dhuhr: Date; asr: Date; maghrib: Date; isha: Date;
}
export const PRAYERS: { key: keyof PrayerTimes; name: string; arabic: string }[] = [
  { key: "fajr", name: "Fajr", arabic: "الفجر" },
  { key: "sunrise", name: "Sunrise", arabic: "الشروق" },
  { key: "dhuhr", name: "Dhuhr", arabic: "الظهر" },
  { key: "asr", name: "Asr", arabic: "العصر" },
  { key: "maghrib", name: "Maghrib", arabic: "المغرب" },
  { key: "isha", name: "Isha", arabic: "العشاء" },
];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => { const r = a - b * Math.floor(a / b); return r < 0 ? r + b : r; };

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  const eqt = q / 15 - RA;
  return { decl, eqt };
}

function julian(y: number, m: number, d: number) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/** Muslim World League angles (Fajr 18°, Isha 17°), Shafi'i Asr (shadow = 1x), the
 * common convention in Kenya. `tz` is the UTC offset in hours (Kenya = +3). */
export function prayerTimes(date: Date, lat: number, lng: number, tz = 3, fajrAngle = 18, ishaAngle = 17, asrFactor = 1): PrayerTimes {
  const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
  const midday = (t: number) => fix(12 - sunPosition(jd + t).eqt, 24);
  const angleTime = (angle: number, t: number, ccw: boolean) => {
    const { decl } = sunPosition(jd + t);
    const noon = midday(t);
    const v = deg(Math.acos((-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat))))) / 15;
    return noon + (ccw ? -v : v);
  };
  const asrTime = (factor: number, t: number) => {
    const { decl } = sunPosition(jd + t);
    const angle = -deg(Math.atan(1 / (factor + Math.tan(rad(Math.abs(lat - decl))))));
    return angleTime(angle, t, false);
  };
  const riseSet = 0.833;
  const times = {
    fajr: angleTime(fajrAngle, 5 / 24, true),
    sunrise: angleTime(riseSet, 6 / 24, true),
    dhuhr: midday(12 / 24),
    asr: asrTime(asrFactor, 13 / 24),
    maghrib: angleTime(riseSet, 18 / 24, false),
    isha: angleTime(ishaAngle, 18 / 24, false),
  };
  const toDate = (h: number) => {
    const local = h + tz - lng / 15;
    const minutes = Math.round(fix(local, 24) * 60);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Build in Nairobi time: shift by the phone's own offset so times are right on any phone.
    const phoneOffset = -d.getTimezoneOffset() / 60;
    d.setMinutes(minutes - (tz - phoneOffset) * 60);
    return d;
  };
  return {
    fajr: toDate(times.fajr), sunrise: toDate(times.sunrise), dhuhr: toDate(times.dhuhr + 2 / 60),
    asr: toDate(times.asr), maghrib: toDate(times.maghrib + 1 / 60), isha: toDate(times.isha),
  };
}

export function nextPrayer(now: Date, today: PrayerTimes, tomorrow: PrayerTimes) {
  for (const p of PRAYERS) {
    if (p.key === "sunrise") continue;
    if (today[p.key] > now) return { ...p, at: today[p.key] };
  }
  return { ...PRAYERS[0], at: tomorrow.fajr };
}

/** Kenyan county seats: a sensible default location before GPS permission. */
export const COUNTY_COORDS: Record<string, [number, number]> = {
  Nairobi: [-1.2864, 36.8172], Mombasa: [-4.0435, 39.6682], Kisumu: [-0.0917, 34.768], Nakuru: [-0.3031, 36.08],
  Garissa: [-0.4532, 39.6461], Wajir: [1.7471, 40.0573], Mandera: [3.9366, 41.867], Lamu: [-2.2717, 40.902],
  Kilifi: [-3.6305, 39.8499], Kwale: [-4.1737, 39.4521], Isiolo: [0.3546, 37.5822], Marsabit: [2.3284, 37.9899],
  Eldoret: [0.5143, 35.2698], "Uasin Gishu": [0.5143, 35.2698], Kiambu: [-1.1714, 36.8356], Machakos: [-1.5177, 37.2634],
  Kakamega: [0.2827, 34.7519], Nyeri: [-0.4201, 36.9476], Meru: [0.047, 37.6559], Malindi: [-3.2192, 40.1169],
  "Tana River": [-1.5, 40.0], "Taita-Taveta": [-3.3961, 38.5561], Kajiado: [-1.8524, 36.7768], Busia: [0.4608, 34.1115],
};

// ---------- Hijri calendar (tabular, Kuwaiti algorithm; ±1 day adjustable) ----------

export const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Ula", "Jumada al-Akhirah",
  "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];

export function toHijri(date: Date, adjustDays = 0) {
  const d = new Date(date.getTime() + adjustDays * 86400000);
  const day = d.getDate();
  let m = d.getMonth() + 1, y = d.getFullYear();
  if (m < 3) { y -= 1; m += 12; }
  let a = Math.floor(y / 100);
  let b = 2 - a + Math.floor(a / 4);
  if (y < 1583) b = 0;
  if (y === 1582) { if (m > 10) b = -10; if (m === 10) { b = 0; if (day > 4) b = -10; } }
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;
  const iyear = 10631 / 30;
  const epochastro = 1948084;
  const shift1 = 8.01 / 60;
  let z = jd - epochastro;
  const cyc = Math.floor(z / 10631);
  z = z - 10631 * cyc;
  const j = Math.floor((z - shift1) / iyear);
  const iy = 30 * cyc + j;
  z = z - Math.floor(j * iyear + shift1);
  let im = Math.floor((z + 28.5001) / 29.5);
  if (im === 13) im = 12;
  const id = z - Math.floor(29.5001 * im - 29);
  return { day: id, month: im, monthName: HIJRI_MONTHS[im - 1], year: iy };
}

export function hijriLabel(date = new Date()) {
  const h = toHijri(date);
  return `${h.day} ${h.monthName} ${h.year} AH`;
}

// ---------- Qibla ----------

const KAABA = { lat: 21.422487, lng: 39.826206 };

/** Initial great-circle bearing from the user to the Kaaba, degrees clockwise from true north. */
export function qiblaBearing(lat: number, lng: number): number {
  const φ1 = rad(lat), φ2 = rad(KAABA.lat), Δλ = rad(KAABA.lng - lng);
  const y = Math.sin(Δλ);
  const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
  return fix(deg(Math.atan2(y, x)), 360);
}

export function distanceToMakkahKm(lat: number, lng: number): number {
  const R = 6371;
  const dφ = rad(KAABA.lat - lat), dλ = rad(KAABA.lng - lng);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(KAABA.lat)) * Math.sin(dλ / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---------- Zakat ----------

export interface ZakatInput {
  cash: number; gold_grams: number; silver_grams: number; business_goods: number; receivables: number;
  investments: number; debts_due: number;
}

export function computeZakat(input: ZakatInput, prices: { gold: number; silver: number; basis: "gold" | "silver"; goldNisab: number; silverNisab: number; rate: number }) {
  const goldValue = input.gold_grams * prices.gold;
  const silverValue = input.silver_grams * prices.silver;
  const assets = input.cash + goldValue + silverValue + input.business_goods + input.receivables + input.investments;
  const net = Math.max(0, assets - input.debts_due);
  const nisab = prices.basis === "gold" ? prices.goldNisab * prices.gold : prices.silverNisab * prices.silver;
  const due = net >= nisab ? net * prices.rate : 0;
  return { assets, net, nisab, due, eligible: net >= nisab, goldValue, silverValue };
}
