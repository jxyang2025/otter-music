import {
  search,
  getSongUrl,
  getSongDetail,
  getLyric,
  getPlaylistDetail,
} from "./netease-api";
import type { Context } from "hono";
import type { Env } from "../../types/hono";

export async function handleNeteaseRequest(
  c: Context<{ Bindings: Env }>,
  query: Record<string, string>
) {
  try {
    const type = query.types;

    const cookie = query.cookie || "";

    if (type === "playlist") {
      const id = query.id || "";
      const res = await getPlaylistDetail(id, cookie);
      // getPlaylistDetail returns { ...playlist, tracks } (flattened)
      // 如果 tracks 为空（getTracksDetail 被风控），至少包含 trackIds 让前端可展示
      if (res && (res as any).error) {
        return c.json({ ...(res as any), _debug: "new_handler_v2" }, 502);
      }
      const r = res as any;
      return c.json({
        ...r,
        tracks: Array.isArray(r.tracks) && r.tracks.length > 0 ? r.tracks : [],
        trackIds: Array.isArray(r.trackIds) ? r.trackIds : [],
        trackCount: r.trackCount ?? 0,
        _debug: "new_handler_v2",
      });
    }

    if (type === "search") {
      const name = query.name || "";
      const page = parseInt(query.pages || "1");
      const count = parseInt(query.count || "20");

      const res = await search(name, 1, page, count, cookie);

      // Map to Meting-like format expected by frontend
      if (res.data.result && res.data.result.songs) {
        const list = res.data.result.songs.map((s: any) => ({
          id: s.id,
          name: s.name,
          artist: s.artists.map((a: any) => a.name),
          album: s.album.name,
          pic: s.album.picUrl, // Direct URL
          source: "_netease",
          url_id: s.id,
          pic_id: s.id,
          lyric_id: s.id,
        }));
        return c.json(list);
      }
      return c.json([]);
    }

    if (type === "url") {
      const id = query.id || "";
      let br = parseInt(query.br) || 192000;
      if (br < 1000) br *= 1000; // kps形式的需要补全位数
      const res = await getSongUrl(id, br, cookie);

      if (res.data.data && res.data.data[0]) {
        return c.json({
          url: res.data.data[0].url,
          br: res.data.data[0].br,
          size: res.data.data[0].size,
        });
      }
      return c.json({ url: "" });
    }

    if (type === "pic") {
      const id = query.id || "";
      // Fix: frontend passes URL as ID for imported tracks
      if (id.startsWith("http")) {
        return c.json({ url: id });
      }

      const res = await getSongDetail(id, cookie);
      if (res && res.al) {
        return c.json({
          url: res.al.picUrl,
        });
      }
      return c.json({ url: "" });
    }

    if (type === "lyric") {
      const id = query.id || "";
      const res = await getLyric(id, cookie);
      return c.json({
        lyric: res.data.lrc?.lyric || "",
        tlyric: res.data.tlyric?.lyric || "",
      });
    }
  } catch (e: any) {
    console.error("Local NetEase Handler Error:", e);
    return c.json({ error: e.message }, 500);
  }
}
