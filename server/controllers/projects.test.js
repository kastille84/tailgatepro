// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const projectsService = require("../services/projects");
const {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} = require("./projects");

const listForCompanySpy = vi.spyOn(projectsService, "listForCompany");
const createSpy = vi.spyOn(projectsService, "create");
const updateSpy = vi.spyOn(projectsService, "update");
const removeSpy = vi.spyOn(projectsService, "remove");

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

describe("projects controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    listForCompanySpy.mockReset();
    createSpy.mockReset();
    updateSpy.mockReset();
    removeSpy.mockReset();
    req = {
      user: { id: "auth-user-1", companyId: "company-1", role: "foreman" },
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("listProjects", () => {
    it("should respond 200 with the company's live projects", async () => {
      // Arrange
      listForCompanySpy.mockResolvedValue([project]);

      // Act
      await listProjects(req, res, next);

      // Assert
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", {
        includeArchived: false,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [project] });
      expect(next).not.toHaveBeenCalled();
    });

    it("should pass includeArchived through when the query flag is 'true'", async () => {
      // Arrange
      req.query = { includeArchived: "true" };
      listForCompanySpy.mockResolvedValue([project]);

      // Act
      await listProjects(req, res, next);

      // Assert
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", {
        includeArchived: true,
      });
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      listForCompanySpy.mockRejectedValue(error);

      // Act
      await listProjects(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("createProject", () => {
    it("should call the service with the body fields and req.user.companyId, and respond 201", async () => {
      // Arrange
      req.body = {
        id: "project-1",
        name: "Downtown Highrise",
        gcNameCustom: "Acme GC",
      };
      createSpy.mockResolvedValue(project);

      // Act
      await createProject(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith({
        id: "project-1",
        ownerCompanyId: "company-1",
        name: "Downtown Highrise",
        gcCompanyId: undefined,
        gcNameCustom: "Acme GC",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: project });
    });

    it("should ignore an owner_company_id planted in the body and use req.user.companyId", async () => {
      // Arrange
      req.body = {
        id: "project-1",
        name: "Downtown Highrise",
        gcNameCustom: "Acme GC",
        ownerCompanyId: "attacker-company",
      };
      createSpy.mockResolvedValue(project);

      // Act
      await createProject(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ ownerCompanyId: "company-1" }),
      );
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      createSpy.mockRejectedValue(error);

      // Act
      await createProject(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("updateProject", () => {
    it("should call the service with req.params.id, req.user.companyId, and the body patch, and respond 200", async () => {
      // Arrange
      req.params = { id: "project-1" };
      req.body = { status: "completed" };
      updateSpy.mockResolvedValue({ ...project, status: "completed" });

      // Act
      await updateProject(req, res, next);

      // Assert
      expect(updateSpy).toHaveBeenCalledWith({
        id: "project-1",
        companyId: "company-1",
        patch: {
          name: undefined,
          status: "completed",
          gcCompanyId: undefined,
          gcNameCustom: undefined,
          archived: undefined,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { ...project, status: "completed" },
      });
    });

    it("should pass an archived flag through to the service patch", async () => {
      // Arrange
      req.params = { id: "project-1" };
      req.body = { archived: true };
      updateSpy.mockResolvedValue({
        ...project,
        archivedAt: "2026-09-09T12:00:00.000Z",
      });

      // Act
      await updateProject(req, res, next);

      // Assert
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          patch: expect.objectContaining({ archived: true }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      req.params = { id: "project-1" };
      const error = new Error("boom");
      updateSpy.mockRejectedValue(error);

      // Act
      await updateProject(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("deleteProject", () => {
    it("should call the service with req.params.id and req.user.companyId, and respond 200", async () => {
      // Arrange
      req.params = { id: "project-1" };
      removeSpy.mockResolvedValue({ id: "project-1" });

      // Act
      await deleteProject(req, res, next);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith({
        id: "project-1",
        companyId: "company-1",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: "project-1" },
      });
    });

    it("should forward a service error to next() (e.g. the 409 archive-instead guard)", async () => {
      // Arrange
      req.params = { id: "project-1" };
      const error = new Error("This project has logged safety talks…");
      removeSpy.mockRejectedValue(error);

      // Act
      await deleteProject(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
