import { createFileRoute } from "@tanstack/react-router";
import newsHtml from "../news-app.html?raw";

function attr(value: string) {
  const amp = "&" + "amp;";
  const quot = "&" + "quot;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  return value.replace(/&/g, amp).replace(/"/g, quot).replace(/</g, lt).replace(/>/g, gt);
}

function httpsUrl(value: string | null) {
  try {
    const url = new URL(value || "");
    if (url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

const SOURCE_NAMES: Record<string, string> = {
  "telegrafi.com": "Telegrafi",
  "gazetaexpress.com": "Gazeta Express",
  "indeksonline.net": "Indeksonline",
  "reporteri.net": "Reporteri",
  "lajmi.net": "Lajmi.net",
  "kultplus.com": "KultPlus",
  "nacionale.com": "Nacionale",
  "panorama.com.al": "Panorama",
  "shqiptarja.com": "Shqiptarja",
  "syri.net": "Syri",
  "top-channel.tv": "Top Channel",
  "zeri.info": "Zëri",
  "fshf.org": "FSHF",
  "ffk-kosova.com": "FFK",
  "topsporti.com": "TopSporti",
};

function sourceFromHost(hostname: string) {
  const host = hostname.replace(/^www\./, "");
  return SOURCE_NAMES[host] || host;
}

function metaContent(html: string, key: string) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    "i",
  );
  const match = html.match(re);
  return (match?.[1] || match?.[2] || "").replace(/&/g, "&").replace(/"/g, '"').replace(/&#39;/g, "'").trim();
}

async function previewFromArticle(articleUrl: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(articleUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "text/html", "user-agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 250000);
    const title = (metaContent(html, "og:title") || "").replace(/\s+[|–—-]\s+.*$/, "").slice(0, 180);
    const image = httpsUrl(metaContent(html, "og:image"));
    if (!title) return null;
    return { title, image, source: sourceFromHost(new URL(articleUrl).hostname) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function withSharePreview(html: string, requestUrl: string, preview: { title: string; image: string | null; source: string } | null) {
  const url = new URL(requestUrl);
  const title = (preview?.title || url.searchParams.get("t") || "").trim().slice(0, 180);
  const image = preview?.image || httpsUrl(url.searchParams.get("i"));
  const source = (preview?.source || url.searchParams.get("s") || "").trim().slice(0, 80);
  if (!title) return html;
  const t = attr(title);
  const desc = attr(
    `Gjeneratori më i madh i lajmeve shqiptare ndan këtë artikull nga "${source || "portali"}"`,
  );
  const page = attr(url.origin + url.pathname + url.search);
  let next = html
    .replace("<title>Lajmet e mia</title>", `<title>${t}</title>`)
    .replace("<head>", '<head><meta name="article-share" content="1">')
    .replace(
      'property="og:title" content="Lajmet e mia · Lajmet e fundit në një vend"',
      `property="og:title" content="${t}"`,
    )
    .replace(
      'property="og:description" content="Lajmet më të reja nga Telegrafi, Gazeta Express, Indeksonline, Reporteri, Lajmi.net dhe të tjerë, të përditësuara çdo 3 minuta."',
      `property="og:description" content="${desc}"`,
    )
    .replace(
      'name="description" content="Lajmet e fundit nga Kosova, Shqipëria dhe bota, nga portalet kryesore shqiptare, në një vend. Rifreskim automatik çdo 3 minuta."',
      `name="description" content="${desc}"`,
    )
    .replace('property="og:url" content="https://lajme.fitimxharra.com/"', `property="og:url" content="${page}"`)
    .replace(
      'name="twitter:title" content="Lajmet e mia · Lajmet e fundit në një vend"',
      `name="twitter:title" content="${t}"`,
    );
  if (image) {
    const photo = attr(`${url.origin}/api/share-image?u=${encodeURIComponent(image)}`);
    next = next
      .replace(
        'property="og:image" content="https://lajme.fitimxharra.com/og.jpg"',
        `property="og:image" content="${photo}"`,
      )
      .replace('property="og:image:width" content="1200"', 'property="og:image:width" content="600"')
      .replace('property="og:image:height" content="630"', 'property="og:image:height" content="600"')
      .replace('name="twitter:card" content="summary_large_image"', 'name="twitter:card" content="summary"')
      .replace(
        'name="twitter:image" content="https://lajme.fitimxharra.com/og.jpg"',
        `name="twitter:description" content="${desc}"><meta name="twitter:image" content="${photo}"`,
      );
  }
  return next;
}

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const incoming = new URL(request.url);
        const articlePath = (incoming.searchParams.get("a") || "").trim();
        let article = httpsUrl(/^https?:\/\//.test(articlePath) ? articlePath : articlePath ? `https://${articlePath}` : "");
        const preview = article ? await previewFromArticle(article) : null;
        return new Response(withSharePreview(newsHtml, request.url, preview), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
  component: Home,
});

function Home() {
  return (
    <main className="p-8">
      <h1>Lajmet e mia</h1>
      <p>Lajmet e fundit nga Kosova, Shqipëria dhe bota.</p>
    </main>
  );
}
