import { Hono } from "hono";
import type { Env } from "../../types/hono";
import { fetchKuwoPlaylistDetail } from "../../utils/music/kuwo-api";

export const kuwoRoutes = new Hono<{ Bindings: Env }>();

/**
 * 获取酷我公开歌单详情。
 */
kuwoRoutes.post("/playlist", async (c) => {
  const { playlistId } = await c.req.json<{ playlistId: string }>();
  if (!playlistId) return c.json({ error: "playlistId required" }, 400);

  try {
    return c.json(await fetchKuwoPlaylistDetail(playlistId));
  } catch (e: any) {
    console.error("Kuwo API error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});
