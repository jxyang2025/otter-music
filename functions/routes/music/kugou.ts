import { Hono } from "hono";
import type { Env } from "../../types/hono";
import {
  fetchKugouPlaylistDetail,
  resolveKugouShortUrl,
} from "../../utils/music/kugou-api";

export const kugouRoutes = new Hono<{ Bindings: Env }>();

/**
 * 解析酷狗分享短链。
 */
kugouRoutes.post("/resolve-shortlink", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url) return c.json({ error: "url required" }, 400);

  try {
    const resolvedUrl = await resolveKugouShortUrl(url);
    if (!resolvedUrl)
      return c.json({ error: "unable to resolve short link" }, 400);
    return c.json({ resolvedUrl });
  } catch (e: any) {
    console.error("Kugou short URL resolve error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

/**
 * 获取酷狗公开歌单详情。
 */
kugouRoutes.post("/playlist", async (c) => {
  const { playlistId } = await c.req.json<{ playlistId: string }>();
  if (!playlistId) return c.json({ error: "playlistId required" }, 400);

  try {
    return c.json(await fetchKugouPlaylistDetail(playlistId));
  } catch (e: any) {
    console.error("Kugou API error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});
