import { describe, expect, it } from "vitest";

import { detectTimeZone, timeZoneOptions } from "../../src/utils/timeZones";

describe("timeZoneOptions", () => {
  it("returns just the common US/Canada zones with no extra", () => {
    const options = timeZoneOptions();
    expect(options.map((option) => option.value)).toContain("America/Chicago");
    expect(timeZoneOptions(null)).toEqual(options);
  });

  it("does not duplicate a zone that is already listed", () => {
    expect(timeZoneOptions("America/Chicago")).toEqual(timeZoneOptions());
  });

  it("appends an unlisted zone so it is never lost", () => {
    const options = timeZoneOptions("Europe/London");
    expect(options.at(-1)).toEqual({ value: "Europe/London", label: "Europe/London" });
    expect(options).toHaveLength(timeZoneOptions().length + 1);
  });
});

describe("detectTimeZone", () => {
  it("returns an IANA zone string", () => {
    expect(detectTimeZone()).toMatch(/\//);
  });
});
