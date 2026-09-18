import { IMusicProvider } from "../interface";
import {
  MusicTrack,
  SearchPageResult,
  SongLyric,
  SearchIntent,
} from "@/types/music";
import {
  getSongUrl,
  getLyric,
  getSongDetail,
  search as neteaseSearch,
  convertSongToMusicTrack,
  getArtist,
  getAlbum,
  getMusicComments,
} from "@/lib/netease/netease-api";
import { forceHttps } from "@otter-music/shared";
import { logger } from "@/lib/logger";
import { IS_NATIVE } from "@/lib/api/config";
import { requestMusicApiJSON } from "../utils";
import { normalizeTrack } from "../utils";
import type { RawApiTrack } from "../types";

export class NeteaseApiProvider implements IMusicProvider {
  source = "_netease";
  canUnlock = true;

  async search(
    query: string,
    page: number,
    count: number,
    signal?: AbortSignal,
    _intent?: SearchIntent
  ): Promise<SearchPageResult<MusicTrack>> {
    // Web 生产环境：走 Cloudflare Functions 后端适配器（source=_netease 触发 handleNeteaseRequest）
    // 原生环境：直连网易云 API（有 CapacitorHttp 无 CORS 问题）
    // 开发环境：走 Vite 代理 /api/netease
    if (!IS_NATIVE && import.meta.env.PROD) {
      const json = await requestMusicApiJSON<RawApiTrack[]>(
        { types: "search", name: query, count, pages: page },
        "_netease",
        signal
      );
      const items = json.map((t) => normalizeTrack(t, "_netease"));
      return { items, hasMore: items.length === count };
    }

    const res = await neteaseSearch(query, 1, page, count);
    const songs = res.data.result.songs || [];
    const items = songs.map((s) => convertSongToMusicTrack(s));
    return {
      items,
      hasMore:
        res.data.result.hasMore ??
        (res.data.result.songCount || 0) > page * count,
    };
  }

  async getUrl(track: MusicTrack, br: number = 192): Promise<string | null> {
    try {
      if (!IS_NATIVE && import.meta.env.PROD) {
        const json = await requestMusicApiJSON<{ url: string; br: number; size: number }>(
          { types: "url", id: track.id, br },
          "_netease"
        );
        return forceHttps(json.url) || null;
      }
      const res = await getSongUrl(track.id, br * 1000);
      return forceHttps(res.data?.data?.[0]?.url) || null;
    } catch (e) {
      logger.error("NeteaseProvider", "NeteaseProvider getUrl failed:", e);
      return null;
    }
  }

  async getPic(track: MusicTrack, size: number = 800): Promise<string | null> {
    try {
      if (!IS_NATIVE && import.meta.env.PROD) {
        const json = await requestMusicApiJSON<{ url: string }>(
          { types: "pic", id: track.id },
          "_netease"
        );
        const url = json.url;
        return url ? `${url}?param=${size}y${size}` : null;
      }
      const song = await getSongDetail(track.id);
      const url = song?.al?.picUrl;
      return url ? `${url}?param=${size}y${size}` : null;
    } catch (e) {
      logger.error("NeteaseProvider", "NeteaseProvider getPic failed:", e);
      return null;
    }
  }

  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    try {
      if (!IS_NATIVE && import.meta.env.PROD) {
        const json = await requestMusicApiJSON<{ lyric: string; tlyric: string }>(
          { types: "lyric", id: track.id },
          "_netease"
        );
        return { lyric: json.lyric || "", tlyric: json.tlyric || "" };
      }
      const res = await getLyric(track.id);
      if (!res || !res.data) return { lyric: "", tlyric: "" };
      return {
        lyric: res.data.lrc?.lyric || "",
        tlyric: res.data.tlyric?.lyric || "",
      };
    } catch (e) {
      logger.error("NeteaseProvider", "NeteaseProvider getLyric failed:", e);
      return null;
    }
  }

  // --- Extended Capabilities ---

  async getArtistDetail(id: string) {
    return getArtist(id);
  }

  async getAlbumDetail(id: string) {
    return getAlbum(id);
  }

  async getSongDetail(id: string) {
    return getSongDetail(id);
  }

  async getComments(id: string) {
    return getMusicComments(id);
  }

  async searchArtist(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }

  async searchAlbum(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }
}
