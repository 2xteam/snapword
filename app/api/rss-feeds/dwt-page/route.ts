import { NextResponse } from "next/server";
import Parser from "rss-parser";

export const runtime = "nodejs";

interface EgItem {
  title: string;
  snippet: string;
  fullContent: string;
  link: string;
  pubDate: string;
  category: string;
}

const cache = new Map<number, { data: EgItem[]; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

async function scrapeEgContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SnapWord/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    const entryMatch = html.match(
      /<div class="entry-content"[^>]*>([\s\S]*?)<\/div>\s*(?:<footer|<div class="(?:post-tags|sharedaddy|entry-footer))/,
    );
    if (!entryMatch) return "";

    let text = entryMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;/g, "\u201C")
      .replace(/&#8221;/g, "\u201D")
      .replace(/&#8211;/g, "\u2013")
      .replace(/&#8212;/g, "\u2014")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.length > 3000) text = text.slice(0, 2997) + "…";
    return text;
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const cached = cache.get(page);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ok: true, page, items: cached.data });
  }

  try {
    const parser = new Parser({
      timeout: 10000,
      headers: { "User-Agent": "SnapWord/1.0" },
    });
    const url =
      page === 1
        ? "https://www.englishgrammar.org/feed/"
        : `https://www.englishgrammar.org/feed/?paged=${page}`;

    const feed = await parser.parseURL(url);
    const items: EgItem[] = await Promise.all(
      (feed.items ?? []).map(async (item) => {
        const desc = item.contentSnippet || item.content || "";
        let snippet = desc;
        if (snippet.length > 140) snippet = snippet.slice(0, 137) + "…";

        let fullContent = desc;
        const link = item.link ?? "";
        if (link) {
          const scraped = await scrapeEgContent(link);
          if (scraped) fullContent = scraped;
        }

        return {
          title: item.title ?? "",
          snippet,
          fullContent,
          link,
          pubDate: item.pubDate ?? "",
          category:
            (item.categories as string[] | undefined)?.[0] ?? "Grammar",
        };
      }),
    );

    cache.set(page, { data: items, ts: Date.now() });
    return NextResponse.json({ ok: true, page, items });
  } catch {
    return NextResponse.json({ ok: true, page, items: [] });
  }
}
