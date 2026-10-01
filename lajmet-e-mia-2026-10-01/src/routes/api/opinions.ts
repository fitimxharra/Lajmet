import { createFileRoute } from "@tanstack/react-router";

const PAGES = [
  { src: "Nacionale", url: "https://nacionale.com/opinion" },
  { src: "Syri", url: "https://www.syri.net/op-ed/" },
  { src: "Syri", url: "https://www.syri.net/blog/" },
  { src: "Telegrafi", url: "https://telegrafi.com/lajme/opinione/" },
  { src: "Indeksonline", url: "https://indeksonline.net/opinion/" },
  { src: "Top Channel", url: "https://top-channel.tv/artikuj/opinion/" },
  { src: "Panorama", url: "https://www.panorama.com.al/category/opinion/" },
  { src: "Shqiptarja", url: "https://shqiptarja.com/kategoria/editoriale" },
];

function clean(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&|&#0?38;/g, "&")
    .replace(/"|&#0?34;/g, '"')
    .replace(/&#8217;|&#x2019;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return n > 0 && n < 65536 ? String.fromCharCode(n) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function isIndex(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    path === "/" ||
    /\/(opinione|opinion|op-ed|blog|editoriale)$/i.test(path) ||
    /\/category\/opinion$/i.test(path) ||
    /\/kategoria\/(opinion|editoriale)$/i.test(path) ||
    /\/lajme\/opinione$/i.test(path) ||
    /\/artikuj\/[^/]+\/opinione-[^/]+$/i.test(path) ||
    /\/page\/\d+$/i.test(path)
  );
}

function isGeneric(title: string) {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length < 8 || t.length > 180) return true;
  return /^(opinione?|editorial|editoriale|op-ed|blog)(\s*[-–—|:].*)?$/i.test(t);
}

function personName(value: string) {
  const name = value.replace(/^(nga|by)\s+/i, "").replace(/\s+/g, " ").trim();
  if (name.length < 5 || name.length > 42) return "";
  const words = name.split(" ");
  if (words.length < 2 || words.length > 4) return "";
  if (!words.every((word) => /^[A-ZËÇÁÉÍÓÚÄÖÜ]/.test(word))) return "";
  if (/telegrafi|indeks|panorama|express|reporteri|lajmi|channel|nacionale|shqiptarja|syri|gazeta|bot[aë]\s*sot|top poll/i.test(name)) return "";
  const letters = name.replace(/[^A-Za-zËÇëçÁÉÍÓÚáéíóúÄÖÜäöü]/g, "");
  if (!/[a-zëçáéíóúäöü]/.test(letters)) return "";
  return name;
}

function trailingAuthor(title: string) {
  const match = title.match(/\s+([A-ZËÇÁÉÍÓÚÄÖÜ][A-Za-zËÇëçÁÉÍÓÚáéíóúÄÖÜäöü'’.-]+(?:\s+[A-ZËÇÁÉÍÓÚÄÖÜ][A-Za-zËÇëçÁÉÍÓÚáéíóúÄÖÜäöü'’.-]+){1,2})$/);
  if (!match) return { title, author: "" };
  const author = personName(match[1]);
  if (!author) return { title, author: "" };
  return { title: title.slice(0, match.index).trim(), author };
}

function badPath(pathname: string) {
  return /\/(lokale|real-estate|tag|author|category|kategoria|page)\//i.test(pathname);
}

function authoredBlocks(html: string, page: { src: string; url: string }) {
  const home = new URL(page.url);
  const seen = new Set<string>();
  const items: Array<{ source: string; title: string; url: string; author: string }> = [];
  const re = /<a[^>]*class="[^"]*widget__headline-text[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1200}?<a[^>]*class="[^"]*social-author__name[^"]*"[^>]*>([^<]+)<\/a>([\s\S]{0,500}?<a[^>]*class="[^"]*widget__section[^"]*"[^>]*>([^<]*)<\/a>)?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && items.length < 8) {
    let url: URL;
    try {
      url = new URL(match[1], home);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== home.hostname.replace(/^www\./, "")) continue;
    url.hash = "";
    url.search = "";
    if (isIndex(url.pathname) || badPath(url.pathname) || seen.has(url.href)) continue;
    const section = clean(match[5] || "");
    if (section && !/opinione|editorial|op-ed|kolumn/i.test(section)) continue;
    const author = personName(clean(match[3]));
    let title = clean(match[2]);
    if (!author || isGeneric(title)) continue;
    const named = title.match(/^([^:]{5,42}):\s+\S/);
    const lead = named ? personName(named[1]) : "";
    if (lead && lead !== author) title = title.slice(named![0].indexOf(":") + 1).trim();
    if (isGeneric(title) || title.split(/\s+/).length < 3) continue;
    seen.add(url.href);
    items.push({ source: page.src, title, url: url.href, author });
  }
  return items;
}
function articlesFrom(html: string, page: { src: string; url: string }) {
  const home = new URL(page.url);
  const seen = new Set<string>();
  const items: Array<{ source: string; title: string; url: string; author: string }> = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && items.length < 8) {
    let url: URL;
    try {
      url = new URL(match[1], home);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== home.hostname.replace(/^www\./, "")) continue;
    url.hash = "";
    url.search = "";
    if (isIndex(url.pathname) || badPath(url.pathname)) continue;
    const host = home.hostname.replace(/^www\./, "");
    if (host === "syri.net" && !/\/(op-ed|blog)\//i.test(url.pathname)) continue;
    if (host === "nacionale.com" && !/\/opinion\//i.test(url.pathname)) continue;
    if (host === "top-channel.tv" && !/\/\d{4}\/\d{2}\/\d{2}\//.test(url.pathname)) continue;
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) continue;
    if (parts.length === 1 && (parts[0].length < 18 || !/[-_]/.test(parts[0]))) continue;
    let title = clean(match[2]).replace(/\s+(nacionale|syri|telegrafi|indeksonline|panorama|shqiptarja|top channel)$/i, "").trim();
    const tail = trailingAuthor(title);
    title = tail.title || title;
    const named = title.match(/^([^:]{5,42}):\s+\S/);
    const author = personName(named && !/telegrafi|indeks|panorama|syri|channel|nacionale|shqiptarja/i.test(named[1]) ? named[1] : "") || tail.author;
    if (named && personName(named[1])) title = title.slice(title.indexOf(":") + 1).trim();
    if (!author || isGeneric(title) || title.split(/\s+/).length < 3 || seen.has(url.href)) continue;
    seen.add(url.href);
    items.push({ source: page.src, title, url: url.href, author });
  }
  return items;
}

async function loadPage(page: { src: string; url: string }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(page.url, {
      signal: controller.signal,
      headers: { accept: "text/html", "user-agent": "Mozilla/5.0 Lajmetemia" },
      redirect: "follow",
    });
    if (!res.ok) return [];
    const html = (await res.text()).slice(0, 400_000);
    const authored = authoredBlocks(html, page);
    if (authored.length >= 2) return authored;
    return articlesFrom(html, page);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export const Route = createFileRoute("/api/opinions")({
  server: {
    handlers: {
      GET: async () => {
        const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=180" };
        const batches = await Promise.all(PAGES.map(loadPage));
        const seen = new Set<string>();
        const items = batches.flat().filter((item) => {
          if (seen.has(item.url)) return false;
          seen.add(item.url);
          return true;
        });
        return new Response(JSON.stringify({ items }), { status: 200, headers });
      },
    },
  },
});
