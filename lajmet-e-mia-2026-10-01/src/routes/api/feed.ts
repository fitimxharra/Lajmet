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

function allowedFeed(value: string | null) {
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

export const Route = createFileRoute("/api/feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=60",
        };
        const feed = allowedFeed(new URL(request.url).searchParams.get("url"));
        if (!feed) return new Response("", { status: 404, headers });
        try {
          const upstream = await fetch(feed, {
            headers: {
              accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
              "user-agent": "Mozilla/5.0 Lajmetemia",
            },
            redirect: "follow",
          });
          if (!upstream.ok) return new Response("", { status: 502, headers });
          const text = (await upstream.text()).replace(/^\uFEFF?\s*/, "").slice(0, 1_500_000);
          if (!/<(rss|feed)\b/i.test(text)) return new Response("", { status: 502, headers });
          return new Response(text, { status: 200, headers });
        } catch {
          return new Response("", { status: 502, headers });
        }
      },
    },
  },
});
