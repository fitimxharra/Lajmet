import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = [
  "telegrafi.com",
  "gazetaexpress.com",
  "indeksonline.net",
  "reporteri.net",
  "lajmi.net",
  "cna.al",
  "albanianpost.com",
  "botasot.info",
  "panorama.com.al",
  "kultplus.com",
  "fshf.org",
  "ffk-kosova.com",
  "topsporti.com",
  "nacionale.com",
  "shqiptarja.com",
  "syri.net",
  "top-channel.tv",
  "zeri.info",
];

function allowedPage(value: string | null) {
  try {
    const url = new URL(value || "");
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "");
    if (!ALLOWED.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    return url.href;
  } catch {
    return null;
  }
}

function decode(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&|&#0?38;/g, "&")
    .replace(/"|&#0?34;/g, '"')
    .replace(/&#0?39;|'/g, "'")
    .replace(/&#8217;|&#x2019;/gi, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return n > 0 && n < 65536 ? String.fromCharCode(n) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "i",
    ),
  );
  return decode(match?.[1] || match?.[2] || "");
}

function personName(text: string) {
  const start = text.trim().slice(0, 180);
  const match = start.match(
    /^(?:Shkruan|Nga)\s*,?\s+([A-ZËÇÁÉÍÓÚÄÖÜ][A-Za-zËÇëçÁÉÍÓÚáéíóúÄÖÜäöü.'’-]+(?:\s+[A-ZËÇÁÉÍÓÚÄÖÜ][A-Za-zËÇëçÁÉÍÓÚáéíóúÄÖÜäöü.'’-]+){1,2})/,
  );
  const name = (match?.[1] || "").replace(/[:.,]+$/, "").trim();
  if (name.length < 5 || name.length > 42) return "";
  if (/telegrafi|indeks|panorama|express|reporteri|lajmi|gazeta/i.test(name)) return "";
  return name;
}

function articleText(html: string) {
  const start = html.search(/class=["']full-text["']/i);
  let slice = start >= 0 ? html.slice(start, start + 30000) : html;
  const end = slice.search(/class=["'][^"']*(?:latest-from|related-posts|comments)[^"']*["']/i);
  if (end > 400) slice = slice.slice(0, end);
  slice = slice.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const paragraphs = [...slice.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decode(match[1]))
    .filter((text) => text.length > 40 && !/window\.|function\s*\(/i.test(text));
  return paragraphs.slice(0, 24).join("\n\n");
}

function usableImage(url: string) {
  if (!/^https:\/\//i.test(url)) return "";
  if (/unsplash\.com|logo|icon|sprite|\.svg|avatar-default|1x1/i.test(url)) return "";
  return url;
}

export const Route = createFileRoute("/api/article")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=600",
        };
        const page = allowedPage(new URL(request.url).searchParams.get("url"));
        if (!page) return new Response(JSON.stringify({ error: "unavailable" }), { status: 200, headers });
        try {
          const upstream = await fetch(page, {
            headers: { accept: "text/html", "user-agent": "Mozilla/5.0 Lajmetemia" },
            redirect: "follow",
          });
          if (!upstream.ok) return new Response(JSON.stringify({ error: "unavailable" }), { status: 200, headers });
          const html = (await upstream.text()).slice(0, 800_000);
          const description = meta(html, "og:description") || meta(html, "description");
          const text = articleText(html) || description;
          const avatar = html.match(/social-author__avatar[\s\S]{0,400}?url\((?:"|"|')?(https?:[^"')]+)/i)?.[1] || "";
          const image = usableImage(meta(html, "og:image"));
          return new Response(
            JSON.stringify({
              title: meta(html, "og:title"),
              author: personName(`${description}\n${text}`),
              authorImage: usableImage(decode(avatar)) || image,
              image,
              text,
            }),
            { status: 200, headers },
          );
        } catch {
          return new Response(JSON.stringify({ error: "unavailable" }), { status: 200, headers });
        }
      },
    },
  },
});
