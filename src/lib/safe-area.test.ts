import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTopSafeAreaFallback } from "./safe-area";

// IS_NATIVE 需为 true 才会执行兜底逻辑
vi.mock("@/lib/api/config", () => ({ IS_NATIVE: true }));

const SYSTEM_BAR_KEY = "--safe-area-top";

/** 让探针读到固定的原生/env 生效值（模拟已有可靠来源） */
function mockEffectiveInset(top: number) {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    paddingTop: `${top}px`,
    paddingRight: "0px",
    paddingBottom: "0px",
    paddingLeft: "0px",
  } as unknown as CSSStyleDeclaration);
}

/** 设定屏幕与视口高度，使 screen.height - innerHeight 等于给定系统栏合计高度 */
function mockScreenAndViewport(systemBarTotal: number) {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 800 - systemBarTotal,
  });
  Object.defineProperty(window.screen, "height", {
    configurable: true,
    value: 800,
  });
}

describe("applyTopSafeAreaFallback", () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty(SYSTEM_BAR_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty(SYSTEM_BAR_KEY);
  });

  it("已有可靠安全区来源时不写入兜底值", () => {
    mockEffectiveInset(52);
    mockScreenAndViewport(52);

    const applied = applyTopSafeAreaFallback();

    expect(applied).toBe(false);
    expect(
      document.documentElement.style.getPropertyValue(SYSTEM_BAR_KEY)
    ).toBe("");
  });

  it("无任何来源且存在系统栏时写入兜底值", () => {
    mockEffectiveInset(0);
    mockScreenAndViewport(100); // 状态栏 + 三键导航

    const applied = applyTopSafeAreaFallback();

    expect(applied).toBe(true);
    // 合计的一半 = 50，高于 44px 下限，取 50
    expect(
      document.documentElement.style.getPropertyValue(SYSTEM_BAR_KEY)
    ).toBe("50px");
  });

  it("兜底值不低于原 pt-11 的 44px，保证不会比修复前更差", () => {
    mockEffectiveInset(0);
    mockScreenAndViewport(30); // 手势导航，合计较小

    applyTopSafeAreaFallback();

    // 合计一半为 15，低于下限，取 44
    expect(
      document.documentElement.style.getPropertyValue(SYSTEM_BAR_KEY)
    ).toBe("44px");
  });

  it("调用方提供实测顶部高度时优先采用", () => {
    mockEffectiveInset(0);
    mockScreenAndViewport(100);

    applyTopSafeAreaFallback(56);

    expect(
      document.documentElement.style.getPropertyValue(SYSTEM_BAR_KEY)
    ).toBe("56px");
  });

  it("键盘导致差值过大时视为不可信，不写入", () => {
    mockEffectiveInset(0);
    mockScreenAndViewport(400); // 含键盘高度，超出上限

    const applied = applyTopSafeAreaFallback();

    expect(applied).toBe(false);
    expect(
      document.documentElement.style.getPropertyValue(SYSTEM_BAR_KEY)
    ).toBe("");
  });

  it("无系统栏（差值过小）时不写入", () => {
    mockEffectiveInset(0);
    mockScreenAndViewport(5);

    const applied = applyTopSafeAreaFallback();

    expect(applied).toBe(false);
  });
});
