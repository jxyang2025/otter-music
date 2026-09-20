import { Hono } from "hono";
import type { Env } from "../../types/hono";
import {
  fetchMiguPlaylistDetail,
  fetchMiguSearch,
  fetchMiguSongUrl,
  isMiguPlaylistShortLink,
  resolveMiguShortPlaylistId,
} from "../../utils/music/migu-api";

export const miguRoutes = new Hono<{ Bindings: Env }>();

/**
 * 解析咪咕歌单分享短链。
 */
miguRoutes.post("/resolve-playlist", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url || !isMiguPlaylistShortLink(url))
    return c.json({ error: "invalid Migu playlist short URL" }, 400);

  try {
    const playlistId = await resolveMiguShortPlaylistId(url);
    if (!playlistId)
      return c.json({ error: "unable to resolve playlist ID" }, 400);
    return c.json({ playlistId });
  } catch (e: any) {
    console.error("Migu short URL resolve error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

/**
 * 获取咪咕公开歌单详情。
 */
miguRoutes.post("/playlist", async (c) => {
  const { playlistId } = await c.req.json<{ playlistId: string }>();
  if (!playlistId) return c.json({ error: "playlistId required" }, 400);

  try {
    return c.json(await fetchMiguPlaylistDetail(playlistId));
  } catch (e: any) {
    console.error("Migu API error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

/**
 * 获取咪咕歌曲播放地址。
 */
miguRoutes.post("/song-url", async (c) => {
  const { copyrightId, contentId, br } = await c.req.json<{
    copyrightId: string;
    contentId: string;
    br?: number;
  }>();
  if (!copyrightId || !contentId)
    return c.json({ error: "copyrightId and contentId required" }, 400);

  try {
    return c.json({ url: await fetchMiguSongUrl(copyrightId, contentId, br) });
  } catch (e: any) {
    console.error("Migu song URL error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

/**
 * 咪咕歌曲搜索。
 */
miguRoutes.post("/search", async (c) => {
  const { keyword, page, rows } = await c.req.json<{
    keyword: string;
    page: number;
    rows?: number;
  }>();
  if (!keyword) return c.json({ error: "keyword required" }, 400);

  try {
    return c.json(await fetchMiguSearch(keyword, page ?? 1, rows ?? 20));
  } catch (e: any) {
    console.error("Migu search error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});
