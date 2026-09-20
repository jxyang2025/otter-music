import { Hono } from "hono";
import type { Env } from "../../types/hono";
import {
  fetchQqPlaylistDetail,
  fetchQqMusicSearch,
  fetchQqMusicLyric,
  fetchQqMusicUrl,
} from "../../utils/music/qqmusic-api";

export const qqmusicRoutes = new Hono<{ Bindings: Env }>();

/**
 * 获取 QQ 音乐歌单详情
 */
qqmusicRoutes.post("/playlist", async (c) => {
  const { playlistId } = await c.req.json<{ playlistId: string }>();
  if (!playlistId) return c.json({ error: "playlistId required" }, 400);

  try {
    const detail = await fetchQqPlaylistDetail(playlistId);
    return c.json(detail);
  } catch (e: any) {
    console.error("QQ Music API error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

/**
 * QQ 音乐通用代理端点
 * @method POST
 * @path /proxy
 * @body { type: 'search' | 'lyric', query?, page?, songmid? }
 */
qqmusicRoutes.post("/proxy", async (c) => {
  const body = await c.req.json<{
    type: "search" | "lyric" | "url";
    query?: string;
    page?: number;
    songmid?: string;
    quality?: string;
  }>();

  try {
    if (body.type === "search") {
      if (!body.query) return c.json({ error: "query required" }, 400);
      const result = await fetchQqMusicSearch(body.query, body.page ?? 1);
      return c.json(result);
    }
    if (body.type === "lyric") {
      if (!body.songmid) return c.json({ error: "songmid required" }, 400);
      const result = await fetchQqMusicLyric(body.songmid);
      if (!result) return c.json({ error: "lyric not found" }, 404);
      return c.json(result);
    }
    if (body.type === "url") {
      if (!body.songmid) return c.json({ error: "songmid required" }, 400);
      const quality = body.quality || "320k";
      const result = await fetchQqMusicUrl(body.songmid, quality);
      return c.json(result);
    }
    return c.json({ error: "invalid type" }, 400);
  } catch (e: any) {
    console.error("QQ Music proxy error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});
