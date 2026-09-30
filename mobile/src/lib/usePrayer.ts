import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import { COUNTY_COORDS, nextPrayer, prayerTimes } from "./faith";
import { useProfile } from "./queries";

/** Prayer times for the member's location: GPS if already permitted, else their county. */
export function usePrayer() {
  const { data: profile } = useProfile();
  const [coords, setCoords] = useState<{ lat: number; lng: number; source: "gps" | "county" } | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted) {
        const last = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null));
        if (last) return setCoords({ lat: last.coords.latitude, lng: last.coords.longitude, source: "gps" });
      }
      const c = COUNTY_COORDS[profile?.county ?? ""] ?? COUNTY_COORDS.Nairobi;
      setCoords({ lat: c[0], lng: c[1], source: "county" });
    })().catch(() => setCoords({ lat: COUNTY_COORDS.Nairobi[0], lng: COUNTY_COORDS.Nairobi[1], source: "county" }));
  }, [profile?.county]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return useMemo(() => {
    if (!coords) return null;
    const today = prayerTimes(now, coords.lat, coords.lng);
    const tomorrow = prayerTimes(new Date(now.getTime() + 86400000), coords.lat, coords.lng);
    const next = nextPrayer(now, today, tomorrow);
    const mins = Math.max(0, Math.round((next.at.getTime() - now.getTime()) / 60000));
    const countdown = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    return { coords, today, next, countdown, place: coords.source === "gps" ? "your location" : profile?.county ?? "Nairobi" };
  }, [coords, now, profile?.county]);
}

export const fmtTime = (d: Date) => d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false });
