import { Hono } from "hono";
import type { Env } from "../../types/hono";
import {
  fetchBilibiliSearch,
  fetchBilibiliSongUrl,
  fetchBilibiliSearchCollections,
  fetchBilibiliCollectionDetail,
  proxyBilibiliAudio,
  proxyBilibiliCover,
} from "../../utils/music/bilibili-api";

export const bilibiliRoutes = new Hono<{ Bindings: Env }>();

bilibiliRoutes.post("/search", async (c) => {
  const { keyword, page, rows } = await c.req.json<{
    keyword: string;
    page: number;
    rows?: number;
  }>();
  if (!keyword) return c.json({ error: "keyword required" }, 400);

  try {
    return c.json(await fetchBilibiliSearch(keyword, page ?? 1, rows ?? 20));
  } catch (e: any) {
    console.error("Bilibili search error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

bilibiliRoutes.post("/song-url", async (c) => {
  const { bvid, cid } = await c.req.json<{ bvid: string; cid?: number }>();
  if (!bvid) return c.json({ error: "bvid required" }, 400);

  try {
    return c.json({ url: await fetchBilibiliSongUrl(bvid, cid) });
  } catch (e: any) {
    console.error("Bilibili song URL error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

bilibiliRoutes.get("/audio", async (c) => {
  const bvid = c.req.query("bvid");
  const url = c.req.query("url");
  if (!bvid || !url) return c.json({ error: "bvid and url required" }, 400);

  try {
    return proxyBilibiliAudio(bvid, url, c.req.header("range"));
  } catch (e: any) {
    console.error("Bilibili audio proxy error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

bilibiliRoutes.get("/cover", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "url required" }, 400);

  try {
    return proxyBilibiliCover(url);
  } catch (e: any) {
    console.error("Bilibili cover proxy error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

bilibiliRoutes.post("/search-collections", async (c) => {
  const { keyword, page, rows } = await c.req.json<{
    keyword: string;
    page?: number;
    rows?: number;
  }>();
  if (!keyword) return c.json({ error: "keyword required" }, 400);

  try {
    return c.json(
      await fetchBilibiliSearchCollections(keyword, page ?? 1, rows ?? 20)
    );
  } catch (e: any) {
    console.error("Bilibili search-collections error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

bilibiliRoutes.post("/collection-detail", async (c) => {
  const { albumId, page, pageSize } = await c.req.json<{
    albumId: string;
    page?: number;
    pageSize?: number;
  }>();
  if (!albumId) return c.json({ error: "albumId required" }, 400);

  try {
    const result = await fetchBilibiliCollectionDetail(
      albumId,
      page ?? 1,
      pageSize ?? 30
    );
    return c.json(result);
  } catch (e: any) {
    console.error("Bilibili collection-detail error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});
