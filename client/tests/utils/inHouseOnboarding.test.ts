import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dismissInHouseOnboarding,
  isInHouseOnboardingDismissed,
} from "../../src/utils/inHouseOnboarding";

describe("inHouseOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is not dismissed by default", () => {
    expect(isInHouseOnboardingDismissed("gc-1")).toBe(false);
  });

  it("remembers a dismissal per company", () => {
    dismissInHouseOnboarding("gc-1");

    expect(isInHouseOnboardingDismissed("gc-1")).toBe(true);
    expect(isInHouseOnboardingDismissed("gc-2")).toBe(false);
  });

  it("reads as not dismissed when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(isInHouseOnboardingDismissed("gc-1")).toBe(false);
  });

  it("does not throw when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => dismissInHouseOnboarding("gc-1")).not.toThrow();
  });
});
