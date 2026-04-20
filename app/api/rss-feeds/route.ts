import { NextResponse } from "next/server";
import Parser from "rss-parser";

export const runtime = "nodejs";

/* ── Merriam-Webster Word of the Day ── */

interface WotdItem {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  didYouKnow: string;
  link: string;
  pubDate: string;
}

let wotdCache: { data: WotdItem | null; ts: number } | null = null;

async function fetchWotd(): Promise<WotdItem | null> {
  try {
    const parser = new Parser({
      timeout: 10000,
      headers: { "User-Agent": "SnapWord/1.0" },
    });
    const feed = await parser.parseURL(
      "https://www.merriam-webster.com/wotd/feed/rss2",
    );
    const first = feed.items?.[0];
    if (!first) return null;

    const raw = first.contentSnippet || first.content || "";

    const headerLine = raw.match(
      /^.+?•\s*\\(.+?)\\\s+•\s*(\w+)/m,
    );
    const defBlock = raw.match(
      /\b(?:verb|noun|adjective|adverb|pronoun|preposition|conjunction|interjection)\s*\n([\s\S]+?)(?:\n\/\/|\nSee the entry)/,
    );
    const exMatch = raw.match(/\/\/\s*([\s\S]+?)(?:\nSee the entry)/);
    const realExMatch = raw.match(
      /Examples:\s*\n([\s\S]+?)(?:\nDid you know\?)/,
    );
    const dykMatch = raw.match(
      /Did you know\?\s*\n([\s\S]+?)$/,
    );

    return {
      word: first.title ?? "",
      pronunciation: headerLine?.[1]?.trim() ?? "",
      partOfSpeech: headerLine?.[2]?.trim() ?? "",
      definition: defBlock?.[1]?.trim() ?? "",
      example:
        (realExMatch?.[1] || exMatch?.[1] || "")
          .replace(/^_|_$/g, "")
          .trim(),
      didYouKnow: dykMatch?.[1]?.trim() ?? "",
      link:
        first.link ?? "https://www.merriam-webster.com/word-of-the-day",
      pubDate: first.pubDate ?? "",
    };
  } catch {
    return null;
  }
}

/* ── EnglishGrammar.org ── */

export interface EgItem {
  title: string;
  snippet: string;
  fullContent: string;
  link: string;
  pubDate: string;
  category: string;
}

let egCache: { data: EgItem[]; ts: number } | null = null;

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

async function fetchEg(): Promise<EgItem[]> {
  try {
    const parser = new Parser({
      timeout: 10000,
      headers: { "User-Agent": "SnapWord/1.0" },
    });
    const feed = await parser.parseURL(
      "https://www.englishgrammar.org/feed/",
    );
    const items = (feed.items ?? []).map((item) => {
      const desc = item.contentSnippet || item.content || "";
      let snippet = desc;
      if (snippet.length > 140) snippet = snippet.slice(0, 137) + "…";

      return {
        title: item.title ?? "",
        snippet,
        fullContent: desc,
        link: item.link ?? "",
        pubDate: item.pubDate ?? "",
        category:
          (item.categories as string[] | undefined)?.[0] ?? "Grammar",
      };
    });

    const enriched = await Promise.all(
      items.map(async (item) => {
        if (item.link) {
          const full = await scrapeEgContent(item.link);
          if (full) item.fullContent = full;
        }
        return item;
      }),
    );

    return enriched;
  } catch {
    return [];
  }
}

const CACHE_TTL = 60 * 60 * 1000;

export async function GET() {
  const now = Date.now();

  let wotd: WotdItem | null = null;
  if (wotdCache && now - wotdCache.ts < CACHE_TTL) {
    wotd = wotdCache.data;
  } else {
    wotd = await fetchWotd();
    wotdCache = { data: wotd, ts: now };
  }

  let eg: EgItem[] = [];
  if (egCache && now - egCache.ts < CACHE_TTL) {
    eg = egCache.data;
  } else {
    eg = await fetchEg();
    egCache = { data: eg, ts: now };
  }

  return NextResponse.json({ ok: true, wotd, eg });
}
