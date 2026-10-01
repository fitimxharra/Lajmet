import { createFileRoute } from "@tanstack/react-router";

function coord(value: string | null, min: number, max: number) {
  if (!value || !/^-?\d{1,3}(\.\d{1,6})?$/.test(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function wmoFromWttr(code: number) {
  if (code === 113) return 0;
  if (code === 116) return 2;
  if (code === 119 || code === 122) return 3;
  if (code === 143 || code === 248 || code === 260) return 45;
  if ([179, 182, 227, 230, 323, 326, 329, 332, 335, 338, 368, 371, 374, 377].includes(code)) return 71;
  if ([200, 386, 389, 392, 395].includes(code)) return 95;
  return 61;
}

async function forecastFromWttr(lat: number, lon: number) {
  const upstream = await fetch(`https://wttr.in/${lat},${lon}?format=j1`, {
    headers: { accept: "application/json", "user-agent": "lajmetemia.com weather" },
  });
  if (!upstream.ok) throw new Error("unavailable");
  const data = await upstream.json();
  const current = data?.current_condition?.[0];
  const days = Array.isArray(data?.weather) ? data.weather.slice(0, 3) : [];
  const temperature = Number(current?.temp_C);
  if (!Number.isFinite(temperature) || days.length < 3) throw new Error("unavailable");
  return {
    current: {
      temperature_2m: temperature,
      weather_code: wmoFromWttr(Number(current.weatherCode)),
    },
    daily: {
      time: days.map((day: { date?: string }) => day.date),
      temperature_2m_max: days.map((day: { maxtempC?: string }) => Number(day.maxtempC)),
      temperature_2m_min: days.map((day: { mintempC?: string }) => Number(day.mintempC)),
      weather_code: days.map((day: { hourly?: Array<{ weatherCode?: string }> }) =>
        wmoFromWttr(Number(day.hourly?.[4]?.weatherCode ?? current.weatherCode)),
      ),
    },
  };
}

export const Route = createFileRoute("/api/weather")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lat = coord(url.searchParams.get("lat"), -90, 90);
        const lon = coord(url.searchParams.get("lon"), -180, 180);
        const headers = {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
        };
        if (lat == null || lon == null) {
          return new Response(JSON.stringify({ error: "unavailable" }), { status: 200, headers });
        }
        try {
          const upstream = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FBelgrade&forecast_days=3`,
            { headers: { accept: "application/json" } },
          );
          if (upstream.ok) {
            return new Response(await upstream.text(), { status: 200, headers });
          }
        } catch {
          /* try the backup source */
        }
        try {
          return new Response(JSON.stringify(await forecastFromWttr(lat, lon)), { status: 200, headers });
        } catch {
          return new Response(JSON.stringify({ error: "unavailable" }), { status: 200, headers });
        }
      },
    },
  },
});
