import type { JSONContent } from "@tiptap/core";

/** Pure conversions between a plain `string[]` and the restricted
 *  doc-with-one-bulletList shape `BulletListEditor` enforces (see its doc
 *  comment for why the schema is restricted this way). Kept separate from
 *  the interactive editor component so the data-shape logic gets full unit
 *  coverage independent of ProseMirror/DOM behavior. */

const getListItemText = (listItem: JSONContent): string => {
  const paragraph = listItem.content?.[0];
  const text =
    paragraph?.content?.map((node) => node.text ?? "").join("") ?? "";
  return text.trim();
};

/** Flattens the editor's JSON doc (one `bulletList` of `listItem`s) into a
 *  plain `string[]`, dropping blank/whitespace-only bullets (e.g. a trailing
 *  empty bullet left over from typing). */
export const bulletListJsonToStrings = (json: JSONContent): string[] => {
  const bulletList = json.content?.[0];
  const items = bulletList?.content ?? [];
  return items.map(getListItemText).filter((text) => text.length > 0);
};

/** Seeds the editor's initial doc from a plain `string[]`. When `value` is
 *  empty, seeds a single empty bullet so there's always something to type
 *  into. */
export const stringsToBulletListDoc = (value: string[]): JSONContent => ({
  type: "doc",
  content: [
    {
      type: "bulletList",
      content: (value.length ? value : [""]).map((text) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            ...(text ? { content: [{ type: "text", text }] } : {}),
          },
        ],
      })),
    },
  ],
});
