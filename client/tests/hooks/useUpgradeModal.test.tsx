import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useUpgradeModal } from "../../src/hooks/useUpgradeModal";

describe("useUpgradeModal", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useUpgradeModal());
    expect(result.current.trigger).toBeNull();
    expect(result.current.params).toBeUndefined();
  });

  it("opens with a trigger and params, then closes", () => {
    const { result } = renderHook(() => useUpgradeModal());

    act(() => result.current.open("sub-blur", { subCount: 2, siteName: "A" }));
    expect(result.current.trigger).toBe("sub-blur");
    expect(result.current.params).toEqual({ subCount: 2, siteName: "A" });

    act(() => result.current.close());
    expect(result.current.trigger).toBeNull();
  });
});
