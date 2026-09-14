import { afterEach, describe, expect, it } from "vitest";

import { cacheTalks, getCachedTalks } from "../../../src/utils/db/talksCache";
import { tailgateDb } from "../../../src/utils/db/tailgateDb";
import type { Talk } from "../../../src/interfaces/talk";

const talk = (overrides: Partial<Talk> = {}): Talk => ({
  id: "talk-1",
  slug: "eye-protection",
  title: "Eye Protection on the Jobsite",
  tradeTag: "General Construction",
  tradeTags: ["General Construction"],
  content: "# Eye Protection on the Jobsite\n",
  structured: null,
  attribution: null,
  isGlobal: true,
  companyId: null,
  createdAt: "2026-09-13T00:00:00.000Z",
  ...overrides,
});

afterEach(async () => {
  await tailgateDb.talksCache.clear();
});

describe("cacheTalks", () => {
  it("writes the given talks into the cache", async () => {
    await cacheTalks([talk()]);
    expect(await tailgateDb.talksCache.get("talk-1")).toEqual(talk());
  });

  it("upserts rather than replacing the whole table", async () => {
    await cacheTalks([talk()]);
    await cacheTalks([talk({ id: "talk-2", title: "Other talk" })]);
    expect(await tailgateDb.talksCache.count()).toBe(2);
  });

  it("updates an existing cached talk in place", async () => {
    await cacheTalks([talk({ title: "old title" })]);
    await cacheTalks([talk({ title: "new title" })]);
    expect((await tailgateDb.talksCache.get("talk-1"))?.title).toBe(
      "new title",
    );
  });

  it("is a no-op for an empty list", async () => {
    await cacheTalks([talk()]);
    await cacheTalks([]);
    expect(await tailgateDb.talksCache.count()).toBe(1);
  });
});

describe("getCachedTalks", () => {
  it("returns every cached talk", async () => {
    await tailgateDb.talksCache.bulkPut([talk(), talk({ id: "talk-2" })]);
    const result = await getCachedTalks();
    expect(result.map((t) => t.id).sort()).toEqual(["talk-1", "talk-2"]);
  });

  it("returns an empty array when nothing is cached", async () => {
    expect(await getCachedTalks()).toEqual([]);
  });
});
