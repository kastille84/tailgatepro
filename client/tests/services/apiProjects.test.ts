import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "../../src/services/apiProjects";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const project = {
  id: "project-1",
  ownerCompanyId: "company-1",
  name: "Downtown Highrise",
  gcCompanyId: null,
  gcNameCustom: "Acme GC",
  status: "active",
  archivedAt: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

const GENERIC = "Something went wrong. Please try again.";

describe("apiProjects", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("listProjects", () => {
    it("GETs /api/projects with the bearer token and returns the data array", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [project] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(listProjects("token-123")).resolves.toEqual([project]);
      expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
      });
    });

    it("appends ?includeArchived=true when asked to include archived projects", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [project] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await listProjects("token-123", { includeArchived: true });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/projects?includeArchived=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("rejects with the backend error message on an error response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: async () => ({
            success: false,
            error: "Could not load projects",
          }),
        }),
      );
      await expect(listProjects("token-123")).rejects.toThrow(
        "Could not load projects",
      );
    });

    it("rejects with the generic message when the body has no error field", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ success: false }),
        }),
      );
      await expect(listProjects("token-123")).rejects.toThrow(GENERIC);
    });

    it("rejects with the generic message when JSON parsing fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("bad json");
          },
        }),
      );
      await expect(listProjects("token-123")).rejects.toThrow(GENERIC);
    });
  });

  describe("createProject", () => {
    it("POSTs a client-generated UUID id plus the input, and returns the created project", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: project }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        createProject("token-123", {
          name: "Downtown Highrise",
          gcNameCustom: "Acme GC",
        }),
      ).resolves.toEqual(project);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/projects");
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Bearer token-123");
      expect(JSON.parse(options.body)).toEqual({
        id: expect.stringMatching(UUID_RE),
        name: "Downtown Highrise",
        gcNameCustom: "Acme GC",
      });
    });

    it("rejects with the backend error message (e.g. the 422 check_gc_info failure)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 422,
          json: async () => ({
            success: false,
            error: "A general contractor is required",
          }),
        }),
      );
      await expect(
        createProject("token-123", { name: "x", gcNameCustom: "" }),
      ).rejects.toThrow("A general contractor is required");
    });

    it("rejects with the generic message when the response is unsuccessful without a body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => null,
        }),
      );
      await expect(
        createProject("token-123", { name: "x", gcNameCustom: "y" }),
      ).rejects.toThrow(GENERIC);
    });
  });

  describe("updateProject", () => {
    it("PATCHes /api/projects/:id with the patch body and returns the updated project", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { ...project, status: "completed" },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        updateProject("token-123", "project-1", { status: "completed" }),
      ).resolves.toEqual({ ...project, status: "completed" });

      expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
        body: JSON.stringify({ status: "completed" }),
      });
    });

    it("rejects with the backend error message on a 404", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ success: false, error: "Project not found" }),
        }),
      );
      await expect(
        updateProject("token-123", "missing", { name: "x" }),
      ).rejects.toThrow("Project not found");
    });

    it("rejects with the generic message when JSON parsing fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("bad");
          },
        }),
      );
      await expect(
        updateProject("token-123", "project-1", { name: "x" }),
      ).rejects.toThrow(GENERIC);
    });

    it("sends an archived flag in the patch body", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { ...project, archivedAt: "2026-09-09T12:00:00.000Z" },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await updateProject("token-123", "project-1", { archived: true });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/projects/project-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ archived: true }),
        }),
      );
    });
  });

  describe("deleteProject", () => {
    it("DELETEs /api/projects/:id with the bearer token and returns the id", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "project-1" } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(deleteProject("token-123", "project-1")).resolves.toEqual({
        id: "project-1",
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
      });
    });

    it("rejects with the backend message on the 409 archive-instead guard", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({
            success: false,
            error:
              "This project has logged safety talks and can't be deleted. Archive it instead.",
          }),
        }),
      );
      await expect(deleteProject("token-123", "project-1")).rejects.toThrow(
        "Archive it instead.",
      );
    });

    it("rejects with the generic message when the response body has no error field", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ success: false }),
        }),
      );

      await expect(deleteProject("token-123", "project-1")).rejects.toThrow(
        GENERIC,
      );
    });
  });
});
