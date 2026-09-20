import {
  fetchKuwoPlaylistDetail as fetchKuwoPlaylistPages,
  KUWO_PAGE_SIZE,
  type KuwoPlaylistDetail,
} from "@otter-music/shared";

export { KUWO_PAGE_SIZE };

const KUWO_BASE_URL = "http://nplserver.kuwo.cn";

export async function fetchKuwoPlaylistDetail(
  playlistId: string
): Promise<KuwoPlaylistDetail> {
  return fetchKuwoPlaylistPages(playlistId, async (path) => {
    const res = await fetch(`${KUWO_BASE_URL}${path}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`Kuwo API error: ${res.status}`);
    return res.text();
  });
}
