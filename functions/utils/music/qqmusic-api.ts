import {
  type MusicTrack,
  type QqPlaylistDetail,
  type QqSosoSearchResponse,
  type QqVkeyResponse,
  type SearchPageResult,
  QQ_API_URL,
  QQ_REFERER,
  QQ_SEARCH_BASE_URL,
  buildQqSearchApiPath,
  buildVkeyRequestBody,
  decodeQqHtmlEntities,
  extractVkeyUrl,
  orderQqQualityKeys,
  parseQqPlaylistResponse,
  parseQqSosoSearchResponse,
} from "@otter-music/shared";
import forge from "node-forge";

// --- API 调用 ---

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const QQ_PLAYLIST_API_URL =
  "https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg";

/**
 * 构建 QQ 音乐歌单 API 完整请求 URL。
 * 抽离为纯函数以便测试。
 */
export function buildQqPlaylistApiUrl(id: string): string {
  return `${QQ_PLAYLIST_API_URL}?type=1&json=1&utf8=1&nosign=1&disstid=${encodeURIComponent(id)}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=GB2312&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`;
}

/**
 * 根据歌单 ID 获取 QQ 音乐歌单详情。
 * 在 Cloudflare Worker 环境中运行，绕过浏览器 CORS 限制。
 */
export async function fetchQqPlaylistDetail(
  id: string
): Promise<QqPlaylistDetail> {
  const url = buildQqPlaylistApiUrl(id);
  const res = await fetch(url, {
    headers: {
      Referer: QQ_REFERER,
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) throw new Error(`QQ Music API error: ${res.status}`);

  const rawText = await res.text();
  const data = parseQqPlaylistResponse(rawText);

  if (data.code !== 0)
    throw new Error(`QQ Music API returned code ${data.code}`);
  if (data.subcode && data.subcode !== 0)
    throw new Error(
      data.msg || `QQ Music API returned subcode ${data.subcode}`
    );
  if (!data.cdlist?.length) throw new Error("歌单不存在或已被删除");

  const cd = data.cdlist[0];

  return {
    name: cd.dissname,
    coverUrl: cd.logo,
    trackCount: cd.songnum,
    songs: cd.songlist || [],
  };
}

// --- QQ 音乐搜索 (Worker 端) ---

export async function fetchQqMusicSearch(
  query: string,
  page: number
): Promise<SearchPageResult<MusicTrack>> {
  const res = await fetch(
    `${QQ_SEARCH_BASE_URL}${buildQqSearchApiPath(query, page, 20)}`,
    {
      headers: {
        Referer: QQ_REFERER,
        "User-Agent": USER_AGENT,
      },
    }
  );
  if (!res.ok) {
    console.error(`QQ search failed: HTTP ${res.status} query=${query}`);
    return { items: [], hasMore: false };
  }
  const data = (await res.json()) as QqSosoSearchResponse;
  if (data.code !== 0) {
    console.error(
      `QQ search failed: code=${data.code} msg=${data.message ?? ""} query=${query}`
    );
    return { items: [], hasMore: false };
  }
  return parseQqSosoSearchResponse(data, page, 20);
}

// --- QQ 音乐歌词 (Worker 端) ---

export async function fetchQqMusicLyric(songmid: string) {
  const res = await fetch(
    `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(songmid)}&pcachetime=${Date.now()}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`,
    {
      headers: {
        Referer: QQ_REFERER,
        "User-Agent": USER_AGENT,
        Cookie: "uin=",
      },
    }
  );
  if (!res.ok) return null;
  const rawText = await res.text();
  const jsonStr = rawText
    .replace(/^[\w$.]+\s*\(/, "")
    .replace(/\)\s*;?\s*$/, "");
  const data = JSON.parse(jsonStr);
  const lyric = forge.util.decodeUtf8(forge.util.decode64(data.lyric || ""));
  let tlyric: string | undefined;
  if (data.trans) {
    tlyric = forge.util.decodeUtf8(forge.util.decode64(data.trans));
  }
  return {
    lyric: decodeQqHtmlEntities(lyric),
    tlyric: tlyric ? decodeQqHtmlEntities(tlyric) : undefined,
  };
}

// --- QQ 音乐音频 URL (Worker 端, vkey 直连) ---

/**
 * 通过 QQ 音乐 vkey API 获取音频直链。
 * 根据首选质量键排序请求，请求内按优先级降级，不可播放时返回空 url。
 */
export async function fetchQqMusicUrl(
  songmid: string,
  quality = "320k"
): Promise<{ url?: string }> {
  const body = buildVkeyRequestBody(songmid, orderQqQualityKeys(quality));

  const res = await fetch(QQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: QQ_REFERER,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return {};

  const data = (await res.json()) as QqVkeyResponse;
  const url = extractVkeyUrl(data);
  return url ? { url } : {};
}
