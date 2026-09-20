// functions/utils/proxy/index.ts
import { safeFetch, safePost } from "./fetch";

export * from "./headers";

/**
 * 统一代理 GET 请求入口
 * @param targetUrl 目标 URL
 * @param extraHeaders 额外的自定义请求头
 */
export async function proxyGet(
  targetUrl: string,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const response = await safeFetch(targetUrl, {
    ...extraHeaders,
  });

  return response;
}

/**
 * 统一代理 POST 请求入口
 * @param targetUrl 目标 URL
 * @param extraHeaders 额外的自定义请求头
 * @param body POST body
 */
export async function proxyPost(
  targetUrl: string,
  extraHeaders: Record<string, string>,
  body: string
): Promise<Response> {
  const response = await safePost(targetUrl, extraHeaders, body);
  return response;
}

/**
 * 获取通用代理 URL
 */
export function getProxyUrl(origin: string, targetUrl: string) {
  return `${origin}/proxy?url=${encodeURIComponent(targetUrl)}`;
}
