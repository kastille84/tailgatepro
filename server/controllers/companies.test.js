// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const companiesService = require("../services/companies");
const storageService = require("../services/storage");
const { uploadLogo, getLogoUrl } = require("./companies");

const updateLogoSpy = vi.spyOn(companiesService, "updateLogo");
const getByIdSpy = vi.spyOn(companiesService, "getById");
const uploadBlobSpy = vi.spyOn(storageService, "uploadBlob");
const getSignedUrlSpy = vi.spyOn(storageService, "getSignedUrl");

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
    uploadBlobSpy.mockReset();
    getSignedUrlSpy.mockReset();
    req = {
      params: {},
      body: Buffer.from("png-bytes"),
      user: { id: "user-1", companyId: "company-1", tier: "premium" },
      get: vi.fn().mockReturnValue("image/png"),
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("uploadLogo", () => {
    it("uploads the raw body to Storage and persists the path for a premium-tier caller", async () => {
      // Arrange
      uploadBlobSpy.mockResolvedValue(undefined);
      updateLogoSpy.mockResolvedValue(company);

      // Act
      await uploadLogo(req, res, next);

      // Assert
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

    it("uploads for an enterprise-tier caller", async () => {
      // Arrange
      req.user.tier = "enterprise";
      uploadBlobSpy.mockResolvedValue(undefined);
      updateLogoSpy.mockResolvedValue(company);

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(uploadBlobSpy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects with a 403 AppError, without calling storage or the service, for a basic-tier caller", async () => {
      // Arrange
      req.user.tier = "basic";

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
});
