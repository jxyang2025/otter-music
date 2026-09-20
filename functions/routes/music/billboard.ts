import { Hono } from "hono";
import type { Env } from "../../types/hono";
import { fetchBillboardChart } from "../../utils/music/billboard-api";
import { ok, fail } from "../../utils/response";
import { getFromCache, putToCache } from "../../utils/cache";

export const billboardRoutes = new Hono<{ Bindings: Env }>();

/**
 * Billboard 榜单（服务端抓取 + 缓存）。
 * ?chart=<slug> 指定榜单，默认 Global 200；?date=YYYY-MM-DD 查询历史周榜（官方日期归档）。
 * 缓存以完整 URL 为键，各榜单/各周自动分开。
 */
billboardRoutes.get("/", async (c) => {
  const slug = c.req.query("chart") || "billboard-global-200";
  const date = c.req.query("date");

  // 历史周榜日期格式与下限校验（Hot 100 始于 1958-08）
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail(c, "Invalid date format, expected YYYY-MM-DD", 400);
  }

  try {
    const cachedResponse = await getFromCache(c.req.raw);
    if (cachedResponse) {
      return new Response(cachedResponse.body, cachedResponse);
    }

    const entries = await fetchBillboardChart(slug, date);
    const response = ok(c, entries);
    c.executionCtx.waitUntil(putToCache(c.req.raw, response.clone(), "api"));
    return response;
  } catch (e: any) {
    console.error("Billboard API error:", e);
    return fail(c, e.message || "Internal error", 500);
  }
});
