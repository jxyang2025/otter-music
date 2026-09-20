import type { BillboardChartEntry } from "@otter-music/shared";

// 支持抓取的榜单白名单（slug 即 billboard.com/charts/<slug>/ 路径，2026-08 逐一验证）
export const BILLBOARD_CHART_SLUGS = [
  "billboard-global-200",
  "billboard-global-excl-us",
  "hot-100",
  "r-b-hip-hop-songs",
  "rock-songs",
  "country-songs",
  "dance-electronic-songs",
  "latin-songs",
  "billboard-200",
  "top-album-sales",
  "artist-100",
] as const;

export type BillboardChartSlug = (typeof BILLBOARD_CHART_SLUGS)[number];

// 历史周榜 URL：官方支持 /charts/<slug>/<YYYY-MM-DD>/ 日期归档
const chartUrl = (slug: BillboardChartSlug, date?: string) =>
  date
    ? `https://www.billboard.com/charts/${slug}/${date}/`
    : `https://www.billboard.com/charts/${slug}/`;

// 使用浏览器 UA，降低被 Billboard 风控拦截的概率
const BILLBOARD_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 榜单每行的容器标记（基于真实页面结构，2026-08 验证）
const ROW_SPLITTER = '<div class="o-chart-results-list-row-container">';

/** 基础 HTML 实体解码（榜单文本里会出现 &amp;、&#039; 等） */
const decodeEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** 去掉标签并压缩空白 */
const stripTags = (s: string): string =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * 解析 Billboard 榜单页 HTML，提取（名次、标题、歌手）。
 * 各分榜页面共用同一模板，解析逻辑通用。
 * 页面中 h3#title-of-a-story 还被其他推荐文章复用，因此必须先按行容器切块，再在块内取第一个匹配。
 */
export function parseBillboardChart(html: string): BillboardChartEntry[] {
  const parts = html.split(ROW_SPLITTER).slice(1);
  const entries: BillboardChartEntry[] = [];

  for (const part of parts) {
    const chunkEnd = part.indexOf(ROW_SPLITTER);
    const chunk = chunkEnd === -1 ? part : part.slice(0, chunkEnd);

    const rankM = chunk.match(
      /class="c-label[^"]*"[^>]*>\s*(\d{1,3})\s*<\/span>/
    );
    const titleM = chunk.match(
      /<h3 id="title-of-a-story"[^>]*>([\s\S]*?)<\/h3>/
    );
    // c-label 与 a-no-trucate 之间可能有多个空格或其他类名（如 "c-label  a-no-trucate a-font-secondary"）
    const artistM = chunk.match(
      /<span[^>]*class="[^"]*c-label[^"]*a-no-trucate[^"]*"[^>]*>([\s\S]*?)<\/span>/
    );
    if (!rankM || !titleM) continue;

    const title = decodeEntities(stripTags(titleM[1]));
    // Artist 100 等歌手榜的部分行没有第二行 artist 标签（h3 即歌手名），回退用标题
    const artist = artistM ? decodeEntities(stripTags(artistM[1])) : title;
    if (!title || !artist) continue;

    // 封面取行内第一张 c-lazy-image__img（专辑/歌手榜每行都有缩略图，首图即条目封面）
    const coverM = chunk.match(
      /<img class="c-lazy-image__img[^"]*"[^>]*src="([^"]+)"/
    );
    const cover = coverM?.[1];

    entries.push({ rank: Number(rankM[1]), title, artist, cover });
  }

  return entries;
}

/**
 * 抓取指定 Billboard 榜单（slug 必须在白名单内，防路径注入）。
 * date 为官方归档的榜单周期（YYYY-MM-DD），可查询历史周榜，页面模板相同。
 * 解析为空时抛错，便于上层感知页面结构变化。
 */
export async function fetchBillboardChart(
  slug: string,
  date?: string
): Promise<BillboardChartEntry[]> {
  if (!(BILLBOARD_CHART_SLUGS as readonly string[]).includes(slug)) {
    throw new Error(`Unknown Billboard chart: ${slug}`);
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid Billboard chart date: ${date}`);
  }

  const res = await fetch(chartUrl(slug as BillboardChartSlug, date), {
    headers: { "User-Agent": BILLBOARD_UA },
  });
  if (!res.ok) throw new Error(`Billboard request failed: ${res.status}`);

  const entries = parseBillboardChart(await res.text());
  if (entries.length === 0) {
    throw new Error("Billboard chart parse failed: no entries");
  }
  return entries;
}
