import { IS_NATIVE } from "@/lib/api/config";
import { logger } from "@/lib/logger";

/**
 * Android 状态栏/导航栏安全区的兜底层。
 *
 * 背景：`env(safe-area-inset-*)` 只在 WebView 处于 edge-to-edge 时才有值，
 * 而 Capacitor 的 SystemBars 插件仅在 Android 15+（API 35）注入 CSS 变量。
 * 因此在 Android 14 及以下，`--safe-area-*` 与 `env()` 会同时为 0，
 * 布局只能落在硬编码兜底值上；历史上顶部的兜底是 `pt-11`（44px），
 * 小于部分 ROM 的真实状态栏高度（小米常见约 48-56px），导致内容被状态栏压住。
 *
 * 这里的做法是量而非猜：用探针元素把 `env()` 解析成像素读回，
 * 全部为 0 时再按屏幕与视口的高差推算系统栏占用。
 */

/** 系统栏占用上限：键盘弹出会使差值包含键盘高度，超出此值即判定为不可信 */
const MAX_SYSTEM_BAR_PX = 160;
/** 兜底生效的最小系统栏占用：低于此值说明环境无系统栏（或桌面浏览器） */
const MIN_SYSTEM_BAR_PX = 16;
/** 顶部兜底值下限：不低于原 `pt-11` 的 44px，确保不会比修复前更差 */
const MIN_TOP_FALLBACK_PX = 44;

/**
 * 量出「上下系统栏合计占用的高度（CSS px）」。
 *
 * 用 `screen.height - innerHeight`：前者是屏幕可用高度，后者是 WebView 视口高度，
 * 差值即被系统栏（状态栏 + 导航栏）吃掉的部分。
 * 键盘弹出时差值会包含键盘高度，故用 {@link MAX_SYSTEM_BAR_PX} 判定可信度。
 *
 * @returns 合计高度（px）；不可信时返回 0
 */
function measureSystemBarTotal(): number {
  if (typeof window === "undefined") return 0;

  const screenHeight = window.screen?.height ?? 0;
  const innerHeight = window.innerHeight ?? 0;
  const total = screenHeight - innerHeight;

  if (total < MIN_SYSTEM_BAR_PX || total > MAX_SYSTEM_BAR_PX) return 0;
  return total;
}

/**
 * 读取当前 `--safe-area-inset-*`（原生注入）与 `env()` 的实际生效值。
 *
 * 用带 padding 的探针让浏览器把 `env()` 解析为像素，再从计算样式读回。
 *
 * @returns 四边生效值（px）；未知的边为 0
 */
function readEffectiveInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding-top:var(--safe-area-inset-top,env(safe-area-inset-top,0px));" +
    "padding-right:var(--safe-area-inset-right,env(safe-area-inset-right,0px));" +
    "padding-bottom:var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px));" +
    "padding-left:var(--safe-area-inset-left,env(safe-area-inset-left,0px))";
  document.body.appendChild(probe);

  const style = getComputedStyle(probe);
  const read = (
    key: "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
  ) => parseFloat(style[key]) || 0;

  const result = {
    top: read("paddingTop"),
    right: read("paddingRight"),
    bottom: read("paddingBottom"),
    left: read("paddingLeft"),
  };

  probe.remove();
  return result;
}

/**
 * 在原生注入与 `env()` 均缺失时，补齐顶部（状态栏）安全区。
 *
 * 仅在「所有来源都为 0」且「确实存在系统栏占用」时才写入，
 * 因此对 Android 15+（原生注入）与 edge-to-edge（`env()` 有值）的场景零副作用。
 * 兜底值同时作用于 `.pt-safe` 与 toast 的 `--safe-area-top` 消费方。
 *
 * 兜底值的取向：宁可略大也不可偏小。偏小会继续被状态栏遮挡，
 * 偏大只是多留一点白，观感问题不影响使用与交互。
 *
 * @param topInset 由调用方提供的确切顶部高度（如原生插件实测），优先于推算值
 * @returns 是否写入了兜底值
 */
export function applyTopSafeAreaFallback(topInset?: number): boolean {
  if (!IS_NATIVE || typeof document === "undefined") return false;

  try {
    const effective = readEffectiveInsets();
    if (effective.top > 0) return false; // 已有可靠来源，不干预

    const total = measureSystemBarTotal();
    if (total === 0) return false; // 无可信测量，保持现状

    // 顶部兜底优先级：调用方实测 > 合计的一半（竖屏上下分居）> 原 pt-11 下限。
    // 合计的一半对「状态栏 + 三键导航」约 100px 的机型会给出 ~50px，接近真实状态栏；
    // 对手势导航机型合计约 30px，一半为 15px 偏低，故再由下限兜住。
    const measured = topInset ?? total / 2;
    const fallback = Math.round(Math.max(measured, MIN_TOP_FALLBACK_PX));

    document.documentElement.style.setProperty(
      "--safe-area-top",
      `${fallback}px`
    );
    logger.info("SafeArea", "顶部安全区使用兜底值", {
      fallback,
      systemBarTotal: total,
      source: topInset === undefined ? "measured" : "provided",
    });
    return true;
  } catch (error) {
    logger.warn("SafeArea", "计算顶部安全区兜底值失败", error as Error);
    return false;
  }
}
