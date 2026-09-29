// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const companiesService = require("../services/companies");
const storageService = require("../services/storage");
const brandingService = require("../services/branding");
const { uploadLogo, getLogoUrl, getJoinCode, getMe } = require("./companies");

const updateLogoSpy = vi.spyOn(companiesService, "updateLogo");
const getByIdSpy = vi.spyOn(companiesService, "getById");
const getOrCreateJoinCodeSpy = vi.spyOn(companiesService, "getOrCreateJoinCode");
const uploadBlobSpy = vi.spyOn(storageService, "uploadBlob");
const getSignedUrlSpy = vi.spyOn(storageService, "getSignedUrl");
const resolveBrandingAccessSpy = vi.spyOn(brandingService, "resolveBrandingAccess");

const company = {
  id: "company-1",
  name: "Acme Roofing",
  companyType: "subcontractor",
  tier: "premium",
  logoPath: "company-1/logo",
};

describe("companies controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    updateLogoSpy.mockReset();
    getByIdSpy.mockReset();
    getOrCreateJoinCodeSpy.mockReset();
    uploadBlobSpy.mockReset();
    getSignedUrlSpy.mockReset();
    // Entitled by default so tests unrelated to the branding gate itself
    // (storage/service failure forwarding) don't need to think about it.
    resolveBrandingAccessSpy.mockReset().mockResolvedValue(true);
    req = {
      params: {},
      body: Buffer.from("png-bytes"),
      user: {
        id: "user-1",
        companyId: "company-1",
        companyType: "subcontractor",
        tier: "premium",
      },
      get: vi.fn().mockReturnValue("image/png"),
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("uploadLogo", () => {
    it("uploads the raw body to Storage and persists the path for an entitled caller", async () => {
      // Arrange
      uploadBlobSpy.mockResolvedValue(undefined);
      updateLogoSpy.mockResolvedValue(company);

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(resolveBrandingAccessSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        companyType: "subcontractor",
        tier: "premium",
      });
      expect(uploadBlobSpy).toHaveBeenCalledWith(
        "company-logos",
        "company-1/logo",
        req.body,
        "image/png",
      );
      expect(updateLogoSpy).toHaveBeenCalledWith("company-1", "company-1/logo");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: company });
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects with a 403 AppError, without calling storage or the service, for a non-entitled subcontractor caller", async () => {
      // Arrange
      req.user.tier = "basic";
      resolveBrandingAccessSpy.mockResolvedValue(false);

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(uploadBlobSpy).not.toHaveBeenCalled();
      expect(updateLogoSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Upgrade to Trade Pro to upload a company logo",
        }),
      );
    });

    it("rejects with the GC-specific 403 message for a non-entitled GC caller", async () => {
      // Arrange
      req.user.companyType = "gc";
      req.user.tier = "basic";
      resolveBrandingAccessSpy.mockResolvedValue(false);

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(uploadBlobSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Upgrade to GC Site Pro to upload a company logo",
        }),
      );
    });

    it("forwards a storage upload failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      uploadBlobSpy.mockRejectedValue(error);

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(updateLogoSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });

    it("forwards a companiesService.updateLogo failure to next", async () => {
      // Arrange
      uploadBlobSpy.mockResolvedValue(undefined);
      const error = new Error("boom");
      updateLogoSpy.mockRejectedValue(error);

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getLogoUrl", () => {
    it("returns a signed URL when the company has a logo", async () => {
      // Arrange
      getByIdSpy.mockResolvedValue(company);
      getSignedUrlSpy.mockResolvedValue("https://signed.example/logo.png");

      // Act
      await getLogoUrl(req, res, next);

      // Assert
      expect(getByIdSpy).toHaveBeenCalledWith("company-1");
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        "company-logos",
        "company-1/logo",
        300,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { url: "https://signed.example/logo.png" },
      });
    });

    it("rejects with a 404 AppError, without requesting a signed URL, when the company has no logo", async () => {
      // Arrange
      getByIdSpy.mockResolvedValue({ ...company, logoPath: null });

      // Act
      await getLogoUrl(req, res, next);

      // Assert
      expect(getSignedUrlSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: "No logo has been uploaded for this company",
        }),
      );
    });

    it("forwards a companiesService.getById failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      getByIdSpy.mockRejectedValue(error);

      // Act
      await getLogoUrl(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getJoinCode", () => {
    it("returns the caller's own company join code", async () => {
      // Arrange
      getOrCreateJoinCodeSpy.mockResolvedValue("ABCD2345");

      // Act
      await getJoinCode(req, res, next);

      // Assert
      expect(getOrCreateJoinCodeSpy).toHaveBeenCalledWith("company-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { joinCode: "ABCD2345" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards a companiesService.getOrCreateJoinCode failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      getOrCreateJoinCodeSpy.mockRejectedValue(error);

      // Act
      await getJoinCode(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getMe", () => {
    it("returns the caller's own company profile", async () => {
      // Arrange
      getByIdSpy.mockResolvedValue(company);

      // Act
      await getMe(req, res, next);

      // Assert
      expect(getByIdSpy).toHaveBeenCalledWith("company-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: company });
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards a companiesService.getById failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      getByIdSpy.mockRejectedValue(error);

      // Act
      await getMe(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
