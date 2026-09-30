import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCheckoutSession,
  createPortalSession,
  getBillingSummary,
} from "../../src/services/apiStripe";
import { AlreadySubscribedError } from "../../src/utils/AlreadySubscribedError";

const GENERIC = "Something went wrong. Please try again.";

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data }),
});

const errorResponse = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: async () => body,
});

const badJsonResponse = {
  ok: false,
  status: 502,
  json: async () => {
    throw new Error("bad json");
  },
};

describe("apiStripe", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("getBillingSummary", () => {
    it("GETs /api/stripe/billing with the bearer token", async () => {
      const summary = {
        hasBillingAccount: true,
        subscriptionStatus: "active",
        billingInterval: "monthly",
        currentPeriodEnd: "2027-01-01T00:00:00.000Z",
      };
      const fetchMock = vi.fn().mockResolvedValue(okResponse(summary));
      vi.stubGlobal("fetch", fetchMock);

      await expect(getBillingSummary("token-123")).resolves.toEqual(summary);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/stripe/billing",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer token-123" },
        }),
      );
    });

    it("rejects with the backend error message", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(errorResponse(403, { success: false, error: "Forbidden" })),
      );
      await expect(getBillingSummary("t")).rejects.toThrow("Forbidden");
    });

    it("falls back to a generic message when the error body is unreadable", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(badJsonResponse));
      await expect(getBillingSummary("t")).rejects.toThrow(GENERIC);
    });

    it("falls back to a generic message when the error has no message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(errorResponse(500, { success: false })),
      );
      await expect(getBillingSummary("t")).rejects.toThrow(GENERIC);
    });
  });

  describe("createCheckoutSession", () => {
    it("POSTs the plan and interval and returns the Checkout url", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(okResponse({ url: "https://checkout.stripe.com/s" }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        createCheckoutSession("token-123", "trade-pro", "annual"),
      ).resolves.toEqual({ url: "https://checkout.stripe.com/s" });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/stripe/checkout-session",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token-123",
          },
          body: JSON.stringify({ planId: "trade-pro", interval: "annual" }),
        }),
      );
    });

    it("throws an AlreadySubscribedError on a 409 ALREADY_SUBSCRIBED", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          errorResponse(409, {
            success: false,
            error: "Already subscribed",
            data: { code: "ALREADY_SUBSCRIBED" },
          }),
        ),
      );

      const promise = createCheckoutSession("t", "trade-pro", "monthly");
      await expect(promise).rejects.toBeInstanceOf(AlreadySubscribedError);
      await expect(promise).rejects.toThrow("Already subscribed");
    });

    it("uses the generic message for an ALREADY_SUBSCRIBED without text", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          errorResponse(409, { success: false, data: { code: "ALREADY_SUBSCRIBED" } }),
        ),
      );
      await expect(createCheckoutSession("t", "trade-pro", "monthly")).rejects.toThrow(
        GENERIC,
      );
    });
  });

  describe("createPortalSession", () => {
    it("POSTs to the portal endpoint and returns the url", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(okResponse({ url: "https://billing.stripe.com/p" }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(createPortalSession("token-123")).resolves.toEqual({
        url: "https://billing.stripe.com/p",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/stripe/portal-session",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("rejects with the backend message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          errorResponse(404, { success: false, error: "No billing account yet" }),
        ),
      );
      await expect(createPortalSession("t")).rejects.toThrow("No billing account yet");
    });
  });
});
