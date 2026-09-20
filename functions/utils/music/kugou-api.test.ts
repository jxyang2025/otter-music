import { afterEach, describe, expect, it, vi } from "vitest";

const sharedMock = {
  KUGOU_PAGE_SIZE: 100,
  convertKugouSongToMusicTrack: vi.fn(),
  buildKugouAndroidHeaders: vi.fn(() => ({})),
  buildKugouDeviceRegistrationPayload: vi.fn(),
  fetchKugouGlobalPlaylistPages: vi.fn(),
  fetchKugouPlaylistPages: vi.fn(),
  isKugouGlobalCollectionId: vi.fn(),
  KUGOU_ANDROID_SIGN_KEY: "sign-key",
  KUGOU_RSA_PUBLIC_KEY: "public-key",
  md5Hex: vi.fn(),
  parseKugouDeviceRegistrationResponse: vi.fn(),
  parseKugouGlobalPlaylistSongsResponse: vi.fn(),
  parseKugouPlaylistResponse: vi.fn(),
  withKugouPlaylistMeta: vi.fn(),
  buildKugouGlobalPlaylistInfoUrl: vi.fn(),
  parseKugouGlobalPlaylistInfoResponse: vi.fn(),
  parseKugouPlaylistTitle: vi.fn(),
};

describe("server Kugou API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("@otter-music/shared");
  });

  it(
    "does not generate a device ID while the module is imported",
    { timeout: 15000 },
    async () => {
      vi.doMock("@otter-music/shared", () => sharedMock);
      vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
        throw new Error("randomUUID called in global scope");
      });

      await expect(import("./kugou-api")).resolves.toMatchObject({
        fetchKugouPlaylistDetail: expect.any(Function),
        resolveKugouShortUrl: expect.any(Function),
      });
    }
  );

  it("generates a device ID only when fetching a global playlist", async () => {
    vi.doMock("@otter-music/shared", () => sharedMock);
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "12345678-1234-1234-1234-1234567890ab"
    );
    sharedMock.isKugouGlobalCollectionId.mockReturnValue(true);
    sharedMock.buildKugouDeviceRegistrationPayload.mockReturnValue({
      url: "https://userservice.kugou.com/risk/v2/r_register_dev",
      headers: {},
      body: "body",
      encryptKey: "key",
      iv: "iv",
    });
    sharedMock.parseKugouDeviceRegistrationResponse.mockReturnValue({
      dfid: "server-dfid",
    });
    sharedMock.fetchKugouGlobalPlaylistPages.mockResolvedValue({
      name: "酷狗歌单 gcid_test",
      coverUrl: "",
      trackCount: 1,
      songs: [],
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(new Uint8Array([1])));

    const { fetchKugouPlaylistDetail } = await import("./kugou-api");
    await fetchKugouPlaylistDetail("gcid_test");

    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(sharedMock.buildKugouDeviceRegistrationPayload).toHaveBeenCalledWith(
      "123456781234123412341234567890ab"
    );
    expect(sharedMock.fetchKugouGlobalPlaylistPages).toHaveBeenCalledWith(
      "gcid_test",
      "server-dfid",
      "123456781234123412341234567890ab",
      expect.any(Function),
      expect.any(Function)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://userservice.kugou.com/risk/v2/r_register_dev",
      expect.objectContaining({ method: "POST" })
    );
  });
});
