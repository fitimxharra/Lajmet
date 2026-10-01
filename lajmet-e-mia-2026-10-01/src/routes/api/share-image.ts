import { createFileRoute } from "@tanstack/react-router";

function httpsUrl(value: string | null) {
  try {
    const url = new URL(value || "");
    if (url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/share-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const image = httpsUrl(new URL(request.url).searchParams.get("u"));
        if (!image) return new Response("unavailable", { status: 400 });
        try {
          const upstream = await fetch(image, { headers: { accept: "image/*" } });
          if (!upstream.ok) return new Response("unavailable", { status: 502 });
          const type = (upstream.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
          if (!type.startsWith("image/")) return new Response("unavailable", { status: 415 });
          const bytes = await upstream.arrayBuffer();
          if (!bytes.byteLength || bytes.byteLength > 8_000_000) return new Response("unavailable", { status: 413 });
          return new Response(bytes, {
            headers: {
              "content-type": type,
              "cache-control": "public, max-age=3600",
            },
          });
        } catch {
          return new Response("unavailable", { status: 502 });
        }
      },
    },
  },
});
