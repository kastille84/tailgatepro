import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createNoWorkDay,
  deleteNoWorkDay,
  listNoWorkDays,
} from "../../src/services/apiNoWorkDays";

const noWorkDay = {
  id: "nwd-1",
  jobsiteId: "j1",
  companyId: "c1",
  offDate: "2026-11-26",
  reason: "holiday",
  createdBy: "u1",
  createdAt: "2026-11-20T00:00:00.000Z",
};
const GENERIC = "Something went wrong. Please try again.";
const headers = {
  "Content-Type": "application/json",
  Authorization: "Bearer token-123",
};

const stubFetch = (response: object) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("apiNoWorkDays", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("listNoWorkDays", () => {
    it("GETs the project's marks with the bearer token", async () => {
      const fetchMock = stubFetch({
        ok: true,
        json: async () => ({ success: true, data: [noWorkDay] }),
      });

      await expect(listNoWorkDays("token-123", "p 1")).resolves.toEqual([noWorkDay]);
      expect(fetchMock).toHaveBeenCalledWith("/api/no-work-days?projectId=p%201", {
        method: "GET",
        headers,
      });
    });

    it("rejects with the backend message", async () => {
      stubFetch({
        ok: false,
        json: async () => ({ success: false, error: "Project not found" }),
      });
      await expect(listNoWorkDays("token-123", "p1")).rejects.toThrow("Project not found");
    });

    it("rejects with a generic message when the body is not JSON", async () => {
      stubFetch({
        ok: false,
        json: async () => {
          throw new Error("bad json");
        },
      });
      await expect(listNoWorkDays("token-123", "p1")).rejects.toThrow(GENERIC);
    });
  });

  describe("createNoWorkDay", () => {
    const input = {
      id: "nwd-1",
      projectId: "p1",
      offDate: "2026-11-26",
      reason: "holiday" as const,
    };

    it("POSTs the mark and returns the row", async () => {
      const fetchMock = stubFetch({
        ok: true,
        json: async () => ({ success: true, data: noWorkDay }),
      });

      await expect(createNoWorkDay("token-123", input)).resolves.toEqual(noWorkDay);
      expect(fetchMock).toHaveBeenCalledWith("/api/no-work-days", {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
    });

    it("returns the no-op { ignored: true } answer as success", async () => {
      stubFetch({
        ok: true,
        json: async () => ({ success: true, data: { ignored: true } }),
      });
      await expect(createNoWorkDay("token-123", input)).resolves.toEqual({ ignored: true });
    });

    it("rejects with the backend message", async () => {
      stubFetch({
        ok: false,
        json: async () => ({ success: false, error: "Project not found" }),
      });
      await expect(createNoWorkDay("token-123", input)).rejects.toThrow("Project not found");
    });

    it("rejects with a generic message when the error body has no message", async () => {
      stubFetch({ ok: false, json: async () => ({ success: false }) });
      await expect(createNoWorkDay("token-123", input)).rejects.toThrow(GENERIC);
    });
  });

  describe("deleteNoWorkDay", () => {
    it("DELETEs the mark by id", async () => {
      const fetchMock = stubFetch({
        ok: true,
        json: async () => ({ success: true, data: { id: "nwd-1" } }),
      });

      await expect(deleteNoWorkDay("token-123", "nwd-1")).resolves.toEqual({ id: "nwd-1" });
      expect(fetchMock).toHaveBeenCalledWith("/api/no-work-days/nwd-1", {
        method: "DELETE",
        headers,
      });
    });

    it("rejects with the backend message", async () => {
      stubFetch({
        ok: false,
        json: async () => ({ success: false, error: "This day off is too old to change" }),
      });
      await expect(deleteNoWorkDay("token-123", "nwd-1")).rejects.toThrow(
        "This day off is too old to change",
      );
    });

    it("rejects with a generic message when the error body has no message", async () => {
      stubFetch({ ok: false, json: async () => ({ success: false }) });
      await expect(deleteNoWorkDay("token-123", "nwd-1")).rejects.toThrow(GENERIC);
    });
  });
});
