// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const jobsitesService = require("./jobsites");
const { listForGc, create, update, remove } = require("./inHouseCrews");

const CREW_COLUMNS = "id, name, archived_at, created_at";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const crewRow = {
  id: "crew-1",
  name: "Hyperion - Framing",
  archived_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

const mappedCrew = {
  id: "crew-1",
  name: "Hyperion - Framing",
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const fromSpy = vi.spyOn(supabase, "from");
const attachCrewSpy = vi.spyOn(jobsitesService, "attachCrew");
const errorSpy = vi.spyOn(console, "error");

// A chainable, awaitable query builder resolving to `result`.
const chain = (result) => {
  const c = {};
  ["select", "eq", "is", "in", "order", "insert", "update", "delete"].forEach((method) => {
    c[method] = vi.fn(() => c);
  });
  c.single = vi.fn().mockResolvedValue(result);
  c.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return c;
};

// One builder per `from(table)` call, in call order.
const queueFrom = (...steps) => {
  fromSpy.mockReset();
  steps.forEach(([table, builder]) => {
    fromSpy.mockImplementationOnce((requested) => {
      if (requested !== table) {
        throw new Error(`Expected from("${table}"), got from("${requested}")`);
      }
      return builder;
    });
  });
};

const notFound = () => chain({ data: null, error: { code: "PGRST116" } });
const ownedCrew = () => ["companies", chain({ data: crewRow, error: null })];

beforeEach(() => {
  fromSpy.mockReset();
  attachCrewSpy.mockReset().mockResolvedValue({ alreadyAttached: false });
  errorSpy.mockReset().mockImplementation(() => {});
});

describe("inHouseCrews service: listForGc", () => {
  it("should list only the GC's own crews, archived included, ordered by name", async () => {
    // Arrange
    const query = chain({ data: [crewRow], error: null });
    queueFrom(["companies", query]);

    // Act
    const result = await listForGc("gc-1");

    // Assert
    expect(query.select).toHaveBeenCalledWith(CREW_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("parent_gc_company_id", "gc-1");
    expect(query.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(query.is).not.toHaveBeenCalled();
    expect(result).toEqual([mappedCrew]);
  });

  it("should throw a 502 when the read fails", async () => {
    // Arrange
    queueFrom(["companies", chain({ data: null, error: { code: "OTHER" } })]);

    // Act & Assert
    await expect(listForGc("gc-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load your crews",
    });
  });
});

describe("inHouseCrews service: create", () => {
  const liveSites = [
    { id: "site-1", name: "Riverside Tower" },
    { id: "site-2", name: "Harbor Lofts" },
  ];

  it("should insert a subcontractor company owned by the GC on the basic tier", async () => {
    // Arrange
    const insert = chain({ data: crewRow, error: null });
    queueFrom(["companies", insert]);

    // Act
    const result = await create({ gcCompanyId: "gc-1", name: "Hyperion - Framing" });

    // Assert
    expect(insert.insert).toHaveBeenCalledWith({
      id: expect.stringMatching(UUID_RE),
      name: "Hyperion - Framing",
      company_type: "subcontractor",
      tier: "basic",
      parent_gc_company_id: "gc-1",
    });
    expect(result).toEqual(mappedCrew);
  });

  it("should attach nothing automatically when no job sites are chosen", async () => {
    // Arrange
    queueFrom(["companies", chain({ data: crewRow, error: null })]);

    // Act
    await create({ gcCompanyId: "gc-1", name: "Hyperion - Framing", jobsiteIds: [] });

    // Assert
    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(attachCrewSpy).not.toHaveBeenCalled();
  });

  it("should attach the new crew only to the GC's live jobsites that were chosen", async () => {
    // Arrange
    const sites = chain({ data: liveSites, error: null });
    queueFrom(["companies", chain({ data: crewRow, error: null })], ["jobsites", sites]);

    // Act
    await create({
      gcCompanyId: "gc-1",
      name: "Hyperion - Framing",
      jobsiteIds: ["site-1", "site-2"],
    });

    // Assert
    expect(sites.in).toHaveBeenCalledWith("id", ["site-1", "site-2"]);
    expect(sites.eq).toHaveBeenCalledWith("gc_company_id", "gc-1");
    expect(sites.eq).toHaveBeenCalledWith("status", "active");
    expect(sites.is).toHaveBeenCalledWith("archived_at", null);
    expect(attachCrewSpy).toHaveBeenCalledTimes(2);
    expect(attachCrewSpy).toHaveBeenCalledWith({
      jobsiteId: "site-1",
      jobsiteName: "Riverside Tower",
      crewId: "crew-1",
    });
    expect(attachCrewSpy).toHaveBeenCalledWith({
      jobsiteId: "site-2",
      jobsiteName: "Harbor Lofts",
      crewId: "crew-1",
    });
  });

  it("should throw a 409 when the GC already has a crew with that name", async () => {
    // Arrange
    queueFrom(["companies", chain({ data: null, error: { code: "23505" } })]);

    // Act & Assert
    await expect(create({ gcCompanyId: "gc-1", name: "Hyperion - Framing" })).rejects.toMatchObject({
      statusCode: 409,
      message: "You already have a crew with that name",
    });
    expect(attachCrewSpy).not.toHaveBeenCalled();
  });

  it("should throw a 502 when the insert fails for any other reason", async () => {
    // Arrange
    queueFrom(["companies", chain({ data: null, error: { code: "OTHER" } })]);

    // Act & Assert
    await expect(create({ gcCompanyId: "gc-1", name: "Hyperion - Framing" })).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create the crew",
    });
  });

  it("should still return the crew and log when it fails to attach to one jobsite", async () => {
    // Arrange
    attachCrewSpy.mockRejectedValue(new Error("attach failed"));
    queueFrom(
      ["companies", chain({ data: crewRow, error: null })],
      ["jobsites", chain({ data: [liveSites[0]], error: null })],
    );

    // Act
    const result = await create({
      gcCompanyId: "gc-1",
      name: "Hyperion - Framing",
      jobsiteIds: ["site-1"],
    });

    // Assert
    expect(result).toEqual(mappedCrew);
    expect(errorSpy).toHaveBeenCalledWith(
      "inHouseCrews: could not attach a new crew to a jobsite",
      expect.any(Error),
    );
  });

  it("should still return the crew and log when the jobsite lookup fails", async () => {
    // Arrange
    queueFrom(
      ["companies", chain({ data: crewRow, error: null })],
      ["jobsites", chain({ data: null, error: { code: "OTHER" } })],
    );

    // Act
    const result = await create({
      gcCompanyId: "gc-1",
      name: "Hyperion - Framing",
      jobsiteIds: ["site-1"],
    });

    // Assert
    expect(result).toEqual(mappedCrew);
    expect(errorSpy).toHaveBeenCalledWith(
      "inHouseCrews: could not load jobsites to attach a new crew",
      expect.anything(),
    );
    expect(attachCrewSpy).not.toHaveBeenCalled();
  });
});

describe("inHouseCrews service: update", () => {
  const args = { id: "crew-1", gcCompanyId: "gc-1" };

  it("should rename the crew, scoping the write to the GC's own crew", async () => {
    // Arrange
    const write = chain({ data: { ...crewRow, name: "Hyperion - Roofing" }, error: null });
    queueFrom(ownedCrew(), ["companies", write]);

    // Act
    const result = await update({ ...args, patch: { name: "Hyperion - Roofing" } });

    // Assert
    expect(write.update).toHaveBeenCalledWith({ name: "Hyperion - Roofing" });
    expect(write.eq).toHaveBeenCalledWith("id", "crew-1");
    expect(write.eq).toHaveBeenCalledWith("parent_gc_company_id", "gc-1");
    expect(result.name).toBe("Hyperion - Roofing");
  });

  it("should archive with a timestamp and restore with null", async () => {
    // Arrange
    const archive = chain({ data: crewRow, error: null });
    const restore = chain({ data: crewRow, error: null });
    queueFrom(ownedCrew(), ["companies", archive], ownedCrew(), ["companies", restore]);

    // Act
    await update({ ...args, patch: { archived: true } });
    await update({ ...args, patch: { archived: false } });

    // Assert
    expect(archive.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(restore.update).toHaveBeenCalledWith({ archived_at: null });
  });

  it("should write only the keys present on the patch", async () => {
    // Arrange
    const write = chain({ data: crewRow, error: null });
    queueFrom(ownedCrew(), ["companies", write]);

    // Act
    await update({ ...args, patch: { name: "New" } });

    // Assert
    expect(write.update).toHaveBeenCalledWith({ name: "New" });
  });

  it("should treat another GC's crew as a 404 and write nothing", async () => {
    // Arrange
    const write = chain({ data: crewRow, error: null });
    queueFrom(["companies", notFound()]);

    // Act & Assert
    await expect(update({ ...args, patch: { name: "X" } })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(write.update).not.toHaveBeenCalled();
    expect(fromSpy).toHaveBeenCalledTimes(1);
  });

  it("should throw a 409 when the new name collides with another crew", async () => {
    // Arrange
    queueFrom(ownedCrew(), ["companies", chain({ data: null, error: { code: "23505" } })]);

    // Act & Assert
    await expect(update({ ...args, patch: { name: "Taken" } })).rejects.toMatchObject({
      statusCode: 409,
      message: "You already have a crew with that name",
    });
  });

  it("should throw a 404 if the crew vanished between the check and the write", async () => {
    // Arrange
    queueFrom(ownedCrew(), ["companies", notFound()]);

    // Act & Assert
    await expect(update({ ...args, patch: { name: "X" } })).rejects.toMatchObject({
      statusCode: 404,
      message: "Crew not found",
    });
  });

  it("should throw a 502 when the write fails for any other reason", async () => {
    // Arrange
    queueFrom(ownedCrew(), ["companies", chain({ data: null, error: { code: "OTHER" } })]);

    // Act & Assert
    await expect(update({ ...args, patch: { name: "X" } })).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not update the crew",
    });
  });
});

describe("inHouseCrews service: remove", () => {
  const args = { id: "crew-1", gcCompanyId: "gc-1" };
  const counts = (logs, users) => [
    ["meeting_logs", chain({ count: logs, error: null })],
    ["users", chain({ count: users, error: null })],
  ];

  it("should delete a crew that has no meeting logs and no users", async () => {
    // Arrange
    const del = chain({ error: null });
    queueFrom(ownedCrew(), ...counts(0, 0), ["companies", del]);

    // Act
    const result = await remove(args);

    // Assert
    expect(del.delete).toHaveBeenCalled();
    expect(del.eq).toHaveBeenCalledWith("id", "crew-1");
    expect(del.eq).toHaveBeenCalledWith("parent_gc_company_id", "gc-1");
    expect(result).toEqual({ id: "crew-1" });
  });

  it("should refuse with a 409 and delete nothing when the crew has meeting logs", async () => {
    // Arrange
    queueFrom(ownedCrew(), ...counts(3, 0));

    // Act & Assert
    await expect(remove(args)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("Archive it instead"),
    });
    expect(fromSpy).toHaveBeenCalledTimes(3);
  });

  it("should refuse with a 409 when the crew has users", async () => {
    // Arrange
    queueFrom(ownedCrew(), ...counts(0, 2));

    // Act & Assert
    await expect(remove(args)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("should count logs by the crew's company id", async () => {
    // Arrange
    const logs = chain({ count: 0, error: null });
    queueFrom(ownedCrew(), ["meeting_logs", logs], ["users", chain({ count: 0, error: null })], [
      "companies",
      chain({ error: null }),
    ]);

    // Act
    await remove(args);

    // Assert
    expect(logs.eq).toHaveBeenCalledWith("company_id", "crew-1");
  });

  it("should treat another GC's crew as a 404", async () => {
    // Arrange
    queueFrom(["companies", notFound()]);

    // Act & Assert
    await expect(remove(args)).rejects.toMatchObject({ statusCode: 404 });
    expect(fromSpy).toHaveBeenCalledTimes(1);
  });

  it("should throw a 502 when a count fails", async () => {
    // Arrange
    queueFrom(
      ownedCrew(),
      ["meeting_logs", chain({ count: null, error: { code: "OTHER" } })],
      ["users", chain({ count: 0, error: null })],
    );

    // Act & Assert
    await expect(remove(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not check whether the crew can be deleted",
    });
  });

  it("should throw a 502 when the delete fails", async () => {
    // Arrange
    queueFrom(ownedCrew(), ...counts(0, 0), ["companies", chain({ error: { code: "OTHER" } })]);

    // Act & Assert
    await expect(remove(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not delete the crew",
    });
  });
});
