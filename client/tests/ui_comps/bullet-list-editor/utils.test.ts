import { describe, expect, it } from "vitest";

import {
  bulletListJsonToStrings,
  stringsToBulletListDoc,
} from "../../../src/ui_comps/bullet-list-editor/utils";

describe("stringsToBulletListDoc", () => {
  it("builds one listItem per string", () => {
    const doc = stringsToBulletListDoc(["Inspect rungs", "Wear a harness"]);

    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Inspect rungs" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Wear a harness" }] },
              ],
            },
          ],
        },
      ],
    });
  });

  it("seeds a single empty bullet when the value is empty", () => {
    const doc = stringsToBulletListDoc([]);
    expect(doc.content?.[0]?.content).toEqual([
      { type: "listItem", content: [{ type: "paragraph" }] },
    ]);
  });
});

describe("bulletListJsonToStrings", () => {
  it("flattens each listItem's paragraph text into a plain string array", () => {
    const json = stringsToBulletListDoc(["Inspect rungs", "Wear a harness"]);
    expect(bulletListJsonToStrings(json)).toEqual([
      "Inspect rungs",
      "Wear a harness",
    ]);
  });

  it("concatenates multiple text nodes within one paragraph", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Wear " }, { type: "text", text: "PPE" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(bulletListJsonToStrings(json)).toEqual(["Wear PPE"]);
  });

  it("drops blank and whitespace-only bullets", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph" }] },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "   " }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Real point" }] }],
            },
          ],
        },
      ],
    };
    expect(bulletListJsonToStrings(json)).toEqual(["Real point"]);
  });

  it("returns [] when the doc has no bulletList content", () => {
    expect(bulletListJsonToStrings({ type: "doc" })).toEqual([]);
  });

  it("treats a content node with no text field as empty rather than throwing", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text" }, { type: "text", text: "Real point" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(bulletListJsonToStrings(json)).toEqual(["Real point"]);
  });
});
