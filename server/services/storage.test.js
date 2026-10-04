// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { uploadBlob, getSignedUrl, downloadBlob } = require("./storage");

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

  it("should request a signed URL for the given bucket/path/ttl, with no download option when no filename is given", async () => {
    // Act
    const url = await getSignedUrl("crew-photos", "meeting-1/photo.jpg", 300);

    // Assert
    expect(fromSpy).toHaveBeenCalledWith("crew-photos");
    expect(createSignedUrl).toHaveBeenCalledWith(
      "meeting-1/photo.jpg",
      300,
      undefined,
    );
    expect(url).toBe("https://signed.example/x");
  });

  it("should pass a download filename through as the download option when given", async () => {
    // Act
    await getSignedUrl("crew-photos", "meeting-1/photo.jpg", 300, "site-a-2026-09-14.pdf");

    // Assert
    expect(createSignedUrl).toHaveBeenCalledWith("meeting-1/photo.jpg", 300, {
      download: "site-a-2026-09-14.pdf",
    });
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

describe("storage service: downloadBlob", () => {
  let download;

  beforeEach(() => {
    download = vi.fn().mockResolvedValue({
      // A real Blob's arrayBuffer() always returns an ArrayBuffer sized to
      // exactly its own bytes. `Buffer.from(string).buffer`, by contrast, can
      // be a slice of Node's larger shared allocation pool — using it here
      // would make this mock unrealistic and the assertion below flaky.
      data: { arrayBuffer: async () => new Uint8Array(Buffer.from("jpg-bytes")).buffer },
      error: null,
    });

    fromSpy.mockReset();
    fromSpy.mockImplementation((bucket) => {
      if (bucket === "crew-photos") return { download };
      throw new Error(`Unexpected bucket: ${bucket}`);
    });
  });

  it("should download the object and return its bytes as a Buffer", async () => {
    // Act
    const buffer = await downloadBlob("crew-photos", "meeting-1/photo.jpg");

    // Assert
    expect(fromSpy).toHaveBeenCalledWith("crew-photos");
    expect(download).toHaveBeenCalledWith("meeting-1/photo.jpg");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe("jpg-bytes");
  });

  it("should throw a 502 AppError when the download fails", async () => {
    // Arrange
    download.mockResolvedValue({ data: null, error: new Error("not found") });

    // Act & Assert
    await expect(
      downloadBlob("crew-photos", "meeting-1/photo.jpg"),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not download the file",
    });
  });
});
