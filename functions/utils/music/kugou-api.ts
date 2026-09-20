import {
  buildKugouAndroidHeaders,
  buildKugouDeviceRegistrationPayload,
  convertKugouSongToMusicTrack,
  fetchKugouGlobalPlaylistPages,
  fetchKugouPlaylistPages,
  isKugouGlobalCollectionId,
  KUGOU_PAGE_SIZE,
  parseKugouDeviceRegistrationResponse,
  withKugouPlaylistMeta,
  type KugouPlaylistDetail,
} from "@otter-music/shared";

export { KUGOU_PAGE_SIZE, convertKugouSongToMusicTrack };

const KUGOU_BASE_URL = "http://mobilecdn.kugou.com";
let deviceMid: string | null = null;
let deviceDfid = "-";

/**
 * 获取服务端酷狗设备 ID，并避免在 Cloudflare 全局作用域生成随机值。
 */
function getServerDeviceMid(): string {
  if (!deviceMid) {
    deviceMid = crypto.randomUUID().replace(/-/g, "");
  }
  return deviceMid;
}

/**
 * 注册服务端酷狗设备并返回 dfid。
 */
async function registerServerDevice(mid: string): Promise<string> {
  const payload = await buildKugouDeviceRegistrationPayload(mid);

  const res = await fetch(payload.url, {
    method: "POST",
    headers: payload.headers,
    body: payload.body,
  });

  if (!res.ok) throw new Error(`Kugou device register failed: ${res.status}`);

  const raw = new Uint8Array(await res.arrayBuffer());
  const { dfid } = await parseKugouDeviceRegistrationResponse(
    raw,
    payload.encryptKey,
    payload.iv
  );
  return dfid;
}

/**
 * 获取服务端酷狗 dfid，并在 Worker 实例内复用注册结果。
 */
async function ensureServerDeviceDfid(mid: string): Promise<string> {
  if (deviceDfid === "-") {
    deviceDfid = await registerServerDevice(mid);
  }
  return deviceDfid;
}

// ============================================================
// 歌单获取（直接 fetch + 调用 shared 核心算法）
// ============================================================

export async function fetchKugouPlaylistDetail(
  playlistId: string
): Promise<KugouPlaylistDetail> {
  if (isKugouGlobalCollectionId(playlistId)) {
    const mid = getServerDeviceMid();
    const dfid = await ensureServerDeviceDfid(mid);

    return fetchKugouGlobalPlaylistPages(
      playlistId,
      dfid,
      mid,
      async (url) => {
        const res = await fetch(url, {
          headers: buildKugouAndroidHeaders(url, dfid, mid),
        });
        if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);
        return res.text();
      },
      async (url, body) => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            ...buildKugouAndroidHeaders(url, dfid, mid),
            "Content-Type": "application/json",
          },
          body,
        });
        if (!res.ok) return null;
        return res.text();
      }
    );
  }

  const detail = await fetchKugouPlaylistPages(playlistId, async (path) => {
    const res = await fetch(`${KUGOU_BASE_URL}${path}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);
    return res.text();
  });
  return withKugouPlaylistMeta(playlistId, detail, async (url) => {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    return res.text();
  });
}

// ============================================================
// 短链解析
// ============================================================

export async function resolveKugouShortUrl(
  shortUrl: string
): Promise<string | null> {
  const res = await fetch(shortUrl, { method: "HEAD", redirect: "manual" });
  return res.headers.get("location");
}
