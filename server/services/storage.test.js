// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { uploadBlob, getSignedUrl } = require("./storage");

const fromSpy = vi.spyOn(supabase.storage, "from");

describe("storage service: uploadBlob", () => {
  let upload;

  beforeEach(() => {
    upload = vi.fn().mockResolvedValue({
      data: { id: "obj-1", path: "meeting-1/sig-1.png", fullPath: "signatures/meeting-1/sig-1.png" },
      error: null,
    });

    fromSpy.mockReset();
    fromSpy.mockImplementation((bucket) => {
      if (bucket === "signatures") return { upload };
      throw new Error(`Unexpected bucket: ${bucket}`);
    });
  });

  it("should upload the buffer to the given bucket/path with upsert so a retry overwrites cleanly", async () => {
    // Act
    await uploadBlob(
      "signatures",
      "meeting-1/sig-1.png",
      Buffer.from("png-bytes"),
      "image/png",
    );

    // Assert
    expect(fromSpy).toHaveBeenCalledWith("signatures");
    expect(upload).toHaveBeenCalledWith(
      "meeting-1/sig-1.png",
      Buffer.from("png-bytes"),
      { contentType: "image/png", upsert: true },
    );
  });

  it("should throw a 502 AppError when the upload fails", async () => {
    // Arrange
    upload.mockResolvedValue({ data: null, error: new Error("bucket not found") });

    // Act & Assert
    await expect(
      uploadBlob("signatures", "meeting-1/sig-1.png", Buffer.from("x"), "image/png"),
    ).rejects.toMatchObject({ statusCode: 502, message: "Could not upload the file" });
  });
});

describe("storage service: getSignedUrl", () => {
  let createSignedUrl;

  beforeEach(() => {
    createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed.example/x" }, error: null });

    fromSpy.mockReset();
    fromSpy.mockImplementation((bucket) => {
      if (bucket === "crew-photos") return { createSignedUrl };
      throw new Error(`Unexpected bucket: ${bucket}`);
    });
  });

  it("should request a signed URL for the given bucket/path/ttl", async () => {
    // Act
    const url = await getSignedUrl("crew-photos", "meeting-1/photo.jpg", 300);

    // Assert
    expect(fromSpy).toHaveBeenCalledWith("crew-photos");
    expect(createSignedUrl).toHaveBeenCalledWith("meeting-1/photo.jpg", 300);
    expect(url).toBe("https://signed.example/x");
  });

  it("should throw a 502 AppError when the signed-URL request fails", async () => {
    // Arrange
    createSignedUrl.mockResolvedValue({ data: null, error: new Error("not found") });

    // Act & Assert
    await expect(
      getSignedUrl("crew-photos", "meeting-1/photo.jpg", 300),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not generate a download link",
    });
  });
});
