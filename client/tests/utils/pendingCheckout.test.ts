import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkoutPath,
  clearPendingCheckout,
  parsePendingCheckout,
  readPendingCheckout,
  savePendingCheckout,
  signupPath,
} from "../../src/utils/pendingCheckout";

const KEY = "tailgatepro.pendingCheckout";
const DAY_MS = 24 * 60 * 60 * 1000;

describe("pendingCheckout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("builds the checkout and signup paths", () => {
    expect(checkoutPath("trade-pro", "annual")).toBe(
      "/checkout?plan=trade-pro&interval=annual",
    );
    expect(signupPath("gc-portfolio-10", "monthly")).toBe(
      "/signup?plan=gc-portfolio-10&interval=monthly",
    );
  });

  describe("parsePendingCheckout", () => {
    it("reads a valid plan and interval from the query string", () => {
      expect(
        parsePendingCheckout(new URLSearchParams("plan=trade-pro&interval=annual")),
      ).toEqual({ plan: "trade-pro", interval: "annual" });
    });

    it("returns null when either param is missing or unknown", () => {
      expect(parsePendingCheckout(new URLSearchParams(""))).toBeNull();
      expect(parsePendingCheckout(new URLSearchParams("plan=trade-pro"))).toBeNull();
      expect(
        parsePendingCheckout(new URLSearchParams("plan=nope&interval=annual")),
      ).toBeNull();
      expect(
        parsePendingCheckout(new URLSearchParams("plan=trade-pro&interval=weekly")),
      ).toBeNull();
    });
  });

  it("round-trips a saved choice and clears it", () => {
    savePendingCheckout({ plan: "gc-portfolio-10", interval: "monthly" });
    expect(readPendingCheckout()).toEqual({
      plan: "gc-portfolio-10",
      interval: "monthly",
    });

    clearPendingCheckout();
    expect(readPendingCheckout()).toBeNull();
  });

  it("returns null when nothing is stored", () => {
    expect(readPendingCheckout()).toBeNull();
  });

  it("expires a choice older than a day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    savePendingCheckout({ plan: "trade-pro", interval: "monthly" });

    vi.setSystemTime(Date.now() + DAY_MS - 1000);
    expect(readPendingCheckout()).not.toBeNull();

    vi.setSystemTime(Date.now() + 2000);
    expect(readPendingCheckout()).toBeNull();
  });

  it("returns null for corrupt, untimed or invalid stored values", () => {
    const now = Date.now();
    localStorage.setItem(KEY, "not json");
    expect(readPendingCheckout()).toBeNull();

    localStorage.setItem(
      KEY,
      JSON.stringify({ plan: "trade-pro", interval: "monthly" }),
    );
    expect(readPendingCheckout()).toBeNull();

    localStorage.setItem(
      KEY,
      JSON.stringify({ plan: "nope", interval: "monthly", savedAt: now }),
    );
    expect(readPendingCheckout()).toBeNull();

    localStorage.setItem(
      KEY,
      JSON.stringify({ plan: "trade-pro", interval: "weekly", savedAt: now }),
    );
    expect(readPendingCheckout()).toBeNull();

    localStorage.setItem(KEY, "null");
    expect(readPendingCheckout()).toBeNull();
  });

  it("never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() =>
      savePendingCheckout({ plan: "trade-pro", interval: "monthly" }),
    ).not.toThrow();
    expect(readPendingCheckout()).toBeNull();
    expect(() => clearPendingCheckout()).not.toThrow();
  });
});
