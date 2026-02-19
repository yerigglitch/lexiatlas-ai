import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isFeatureRssEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

let xmlParserCtor: (typeof import("fast-xml-parser"))["XMLParser"] | null = null;

async function getXmlParserCtor() {
  if (!xmlParserCtor) {
    const mod = await import("fast-xml-parser");
    xmlParserCtor = mod.XMLParser;
  }
  return xmlParserCtor;
}

export async function GET(request: NextRequest) {
  if (!isFeatureRssEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  const proxy = env.rssProxyUrl;
  const targetUrl = proxy
    ? proxy.includes("{url}")
      ? proxy.replace("{url}", encodeURIComponent(parsedUrl.toString()))
      : `${proxy}${proxy.includes("?") ? "&" : "?"}url=${encodeURIComponent(
          parsedUrl.toString()
        )}`
    : parsedUrl.toString();

  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": "LexiAtlasAI/1.0",
      Accept: "application/rss+xml, application/xml, text/xml, */*"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      {
        error: `Failed to fetch RSS (status ${response.status})`,
        details: text.slice(0, 500)
      },
      { status: 400 }
    );
  }

  const xml = await response.text();
  const XMLParser = await getXmlParserCtor();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ""
  });
  const data = parser.parse(xml);

  const channel = data?.rss?.channel || data?.feed;
  const items = channel?.item || channel?.entry || [];
  const normalized = Array.isArray(items) ? items : [items];

  const result = normalized
    .filter(Boolean)
    .slice(0, 12)
    .map((item) => {
      const title = item.title?.["#text"] || item.title || "Sans titre";
      const link =
        item.link?.href ||
        (Array.isArray(item.link) ? item.link[0]?.href : item.link) ||
        item.guid ||
        "";
      const date = item.pubDate || item.updated || item.published || "";
      const description = item.description || item.summary || "";
      return { title, link, date, description };
    });

  return NextResponse.json({ items: result });
}
