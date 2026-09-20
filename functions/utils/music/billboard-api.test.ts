import { describe, expect, it } from "vitest";
import { fetchBillboardChart, parseBillboardChart } from "./billboard-api";

// 真实页面片段（2026-08 抓取）：第 1 名 Shakira X Burna Boy
const ROW_FIXTURE = `<div class="o-chart-results-list-row-container">
<ul class="o-chart-results-list-row">
  <li class="o-chart-results-list__item // lrv-u-color-black u-width-60">
    <span class="c-label  a-font-basic u-font-size-33@desktop" >
      1
    </span>
  </li>
  <li class="o-chart-results-list__item // u-width-200">
    <div class="c-lazy-image  lrv-u-width-200">
      <img class="c-lazy-image__img" src="https://charts-static.billboard.com/img/2026/05/xxx-180x180.jpg" alt="">
    </div>
  </li>
  <li class="lrv-u-width-100p a-chart-result-item-container">
    <ul class="lrv-a-unstyle-list">
      <li class="o-chart-results-list__item // lrv-u-flex-grow-1">
        <h3 id="title-of-a-story" class="c-title  a-font-basic">
          Dai Dai (FIFA World Cup Official Song 2026)
        </h3>
        <span class="
          c-label a-no-trucate
          a-font-secondary u-font-size-15
          a-children-link-color-black
          lrv-a-children-link-decoration-underline:hover
        ">
          <a href="https://www.billboard.com/artist/shakira/">Shakira</a> X <a href="https://www.billboard.com/artist/burna-boy/">Burna Boy</a>
        </span>
      </li>
    </ul>
  </li>
</ul>
</div>`;

// 第 2 行：验证实体解码（&amp; 与 &#039;）
const ROW_FIXTURE_2 = `<div class="o-chart-results-list-row-container">
<ul class="o-chart-results-list-row">
  <li class="o-chart-results-list__item // lrv-u-color-black">
    <span class="c-label  a-font-basic">
      2
    </span>
  </li>
  <li class="lrv-u-width-100p a-chart-result-item-container">
    <ul>
      <li>
        <h3 id="title-of-a-story" class="c-title  a-font-basic">
          Rock &amp; Roll &#039;69
        </h3>
        <span class="c-label a-no-trucate">
          <a href="#">Tom &amp; Jerry</a>
        </span>
      </li>
    </ul>
  </li>
</ul>
</div>`;

// 第 3 行：artist 类名含双空格与额外类（Hot 100 真实页面变体，2026-08）
const ROW_FIXTURE_3 = `<div class="o-chart-results-list-row-container">
<ul class="o-chart-results-list-row">
  <li class="o-chart-results-list__item // lrv-u-color-black">
    <span class="c-label  a-font-basic">
      4
    </span>
  </li>
  <li class="lrv-u-width-100p a-chart-result-item-container">
    <ul>
      <li>
        <h3 id="title-of-a-story" class="c-title  a-font-basic">
          Boston
        </h3>
        <span class="c-label  a-no-trucate a-font-secondary u-font-size-15" >
 Stella Lefty
</span>
      </li>
    </ul>
  </li>
</ul>
</div>`;

describe("parseBillboardChart", () => {
  it("解析真实页面片段：名次 / 歌名 / 歌手 / 封面", () => {
    const entries = parseBillboardChart(ROW_FIXTURE);
    expect(entries).toEqual([
      {
        rank: 1,
        title: "Dai Dai (FIFA World Cup Official Song 2026)",
        artist: "Shakira X Burna Boy",
        cover:
          "https://charts-static.billboard.com/img/2026/05/xxx-180x180.jpg",
      },
    ]);
  });

  it("提取首张 c-lazy-image__img 为封面（多类名变体，真实页面结构）", () => {
    const entries = parseBillboardChart(
      `<div class="o-chart-results-list-row-container">
<ul class="o-chart-results-list-row">
  <li class="o-chart-results-list__item // lrv-u-color-black">
    <span class="c-label a-font-basic">7</span>
  </li>
  <li class="lrv-u-width-100p a-chart-result-item-container">
    <ul><li>
      <img class="c-lazy-image__img lrv-u-background-color-grey-lightest lrv-u-width-100p" src="https://charts-static.billboard.com/img/2026/08/album-180x180.jpg" alt="" />
      <h3 id="title-of-a-story" class="c-title a-font-basic">Midnights</h3>
      <span class="c-label a-no-trucate">Taylor Swift</span>
    </li></ul>
  </li>
</ul>
</div>`
    );
    expect(entries).toEqual([
      {
        rank: 7,
        title: "Midnights",
        artist: "Taylor Swift",
        cover:
          "https://charts-static.billboard.com/img/2026/08/album-180x180.jpg",
      },
    ]);
  });

  it("解码 HTML 实体（&amp; / &#039;）", () => {
    const entries = parseBillboardChart(ROW_FIXTURE_2);
    expect(entries).toEqual([
      { rank: 2, title: "Rock & Roll '69", artist: "Tom & Jerry" },
    ]);
  });

  it("兼容 artist 类名双空格 / 中间类名变体（c-label  a-no-trucate a-font-secondary）", () => {
    const entries = parseBillboardChart(ROW_FIXTURE_3);
    expect(entries).toEqual([
      { rank: 4, title: "Boston", artist: "Stella Lefty" },
    ]);
  });

  it("artist 标签缺失时回退用标题（Artist 100 等歌手榜行）", () => {
    const entries = parseBillboardChart(
      `<div class="o-chart-results-list-row-container">
<ul class="o-chart-results-list-row">
  <li class="o-chart-results-list__item // lrv-u-color-black">
    <span class="c-label a-font-basic">14</span>
  </li>
  <li class="lrv-u-width-100p a-chart-result-item-container">
    <ul><li>
      <h3 id="title-of-a-story" class="c-title a-font-basic">Pooh Shiesty</h3>
    </li></ul>
  </li>
</ul>
</div>`
    );
    expect(entries).toEqual([
      { rank: 14, title: "Pooh Shiesty", artist: "Pooh Shiesty" },
    ]);
  });

  it("忽略非榜单内容（页面其他部分复用同款 h3）", () => {
    const html =
      '<h3 id="title-of-a-story">推荐文章标题</h3>' +
      ROW_FIXTURE +
      '<h3 id="title-of-a-story">另一篇推荐文章</h3>';
    const entries = parseBillboardChart(html);
    expect(entries).toHaveLength(1);
    expect(entries[0].rank).toBe(1);
  });

  it("空串 / 无行时返回空数组", () => {
    expect(parseBillboardChart("")).toEqual([]);
    expect(parseBillboardChart("<html><body></body></html>")).toEqual([]);
  });
});

describe("fetchBillboardChart slug 校验", () => {
  it("白名单外的 slug 直接抛错，不发请求", async () => {
    await expect(fetchBillboardChart("../admin")).rejects.toThrow(
      "Unknown Billboard chart"
    );
  });

  it("合法 slug 通过白名单校验（fetch 返回空页时报解析错误）", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("<html></html>");
    try {
      await expect(fetchBillboardChart("hot-100")).rejects.toThrow(
        "no entries"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
