import { describe, expect, it, vi } from "vitest";
import {
  isMiguPlaylistShortLink,
  parseMiguShareRedirectPlaylistId,
  resolveMiguShortPlaylistId,
} from "./migu-api";

describe("migu short playlist links", () => {
  it("accepts only HTTPS c.migu.cn short links", () => {
    expect(
      isMiguPlaylistShortLink("https://c.migu.cn/00CQck?ifrom=share")
    ).toBe(true);
    expect(isMiguPlaylistShortLink("http://c.migu.cn/00CQck")).toBe(false);
    expect(isMiguPlaylistShortLink("https://example.com/00CQck")).toBe(false);
  });

  it("extracts IDs only from Migu playlist share destinations", () => {
    expect(
      parseMiguShareRedirectPlaylistId(
        "https://h5.nf.migu.cn/app/v4/p/share/playlist/index.html?id=234235348&channel=0146921"
      )
    ).toBe("234235348");
    expect(
      parseMiguShareRedirectPlaylistId(
        "https://h5.nf.migu.cn/app/v4/p/share/song/index.html?id=234235348"
      )
    ).toBeNull();
    expect(
      parseMiguShareRedirectPlaylistId(
        "https://example.com/app/v4/p/share/playlist/index.html?id=234235348"
      )
    ).toBeNull();
  });

  it("reads the playlist ID from the short-link redirect location", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location:
            "https://h5.nf.migu.cn/app/v4/p/share/playlist/index.html?id=234235348&channel=0146921",
        },
      })
    );

    await expect(
      resolveMiguShortPlaylistId("https://c.migu.cn/00CQck", fetcher)
    ).resolves.toBe("234235348");
    expect(fetcher).toHaveBeenCalledWith(
      "https://c.migu.cn/00CQck",
      expect.objectContaining({ redirect: "manual" })
    );
  });

  it("rejects redirects without a valid Migu playlist target", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://example.com/playlist?id=234235348" },
      })
    );

    await expect(
      resolveMiguShortPlaylistId("https://c.migu.cn/00CQck", fetcher)
    ).resolves.toBeNull();
  });
});
