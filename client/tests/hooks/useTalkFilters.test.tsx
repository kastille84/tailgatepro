import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useTalkFilters } from "../../src/hooks/useTalkFilters";
import type { Talk } from "../../src/interfaces/talk";

const talks = [
  {
    id: "t1",
    title: "Eye Protection",
    tradeTags: ["General Construction", "Welding"],
    isGlobal: true,
  },
  {
    id: "t2",
    title: "Silica Dust Exposure",
    tradeTags: ["Masonry"],
    isGlobal: false,
  },
] as Talk[];

const tradeOptions = [
  { value: "General Construction", label: "General Construction" },
  { value: "Masonry", label: "Masonry" },
  { value: "Welding", label: "Welding" },
];

describe("useTalkFilters", () => {
  it("returns every talk and a leading 'All trades' option by default", () => {
    const { result } = renderHook(() =>
      useTalkFilters(talks, tradeOptions, new Set()),
    );

    expect(result.current.visibleTalks).toEqual(talks);
    expect(result.current.tradeFilterOptions[0]).toEqual({
      value: "all",
      label: "All trades",
    });
    expect(result.current.tradeFilterOptions).toHaveLength(4);
  });

  it("filters by trade", () => {
    const { result } = renderHook(() =>
      useTalkFilters(talks, tradeOptions, new Set()),
    );

    act(() => result.current.setTrade("Masonry"));

    expect(result.current.visibleTalks).toEqual([talks[1]]);
  });

  it("filters by title search, case-insensitively", () => {
    const { result } = renderHook(() =>
      useTalkFilters(talks, tradeOptions, new Set()),
    );

    act(() => result.current.setSearch("SILICA"));

    expect(result.current.visibleTalks).toEqual([talks[1]]);
  });

  it("filters to favorited talks only", () => {
    const { result } = renderHook(() =>
      useTalkFilters(talks, tradeOptions, new Set(["t2"])),
    );

    act(() => result.current.setFavoritesOnly(true));

    expect(result.current.visibleTalks).toEqual([talks[1]]);
  });

  it("filters to custom (non-global) talks only", () => {
    const { result } = renderHook(() =>
      useTalkFilters(talks, tradeOptions, new Set()),
    );

    act(() => result.current.setCustomOnly(true));

    expect(result.current.visibleTalks).toEqual([talks[1]]);
  });

  it("combines multiple active filters", () => {
    const { result } = renderHook(() =>
      useTalkFilters(talks, tradeOptions, new Set(["t1"])),
    );

    act(() => result.current.setFavoritesOnly(true));
    act(() => result.current.setTrade("Masonry"));

    expect(result.current.visibleTalks).toEqual([]);
  });
});
