import { EditorContent, useEditor } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";

import { StyledEditorWrapper } from "./styles";
import { bulletListJsonToStrings, stringsToBulletListDoc } from "./utils";

// Tiptap's Document node normally allows any sequence of blocks at the
// document root (`content: "block+"`). Restricting it to exactly one
// bulletList means a user can never end up with a stray paragraph outside
// the list -- e.g. from pressing Enter twice on an empty bullet, which is
// default ProseMirror behavior otherwise -- so `bulletListJsonToStrings`
// only ever has one shape to walk.
const RestrictedDocument = Document.extend({ content: "bulletList" });

// Only Document/Paragraph/Text/BulletList/ListItem/undo-redo are registered
// -- every mark (bold, italic, strike, code) and every other node (heading,
// blockquote, codeBlock, orderedList, link, underline, horizontalRule) is
// turned off. This makes "plain text only" structural, not a post-hoc
// strip: the schema itself can't represent formatting, so `value` is always
// a plain `string[]`, identical in shape to a harvested talk's `structured`
// arrays -- nothing needs sanitizing.
const extensions = [
  RestrictedDocument,
  StarterKit.configure({
    document: false, // RestrictedDocument replaces it, above
    bold: false,
    italic: false,
    strike: false,
    code: false,
    codeBlock: false,
    heading: false,
    blockquote: false,
    horizontalRule: false,
    orderedList: false,
    link: false,
    underline: false,
    hardBreak: false,
    gapcursor: false,
    dropcursor: false,
    trailingNode: false,
  }),
];

interface BulletListEditorProps {
  id?: string;
  value: string[];
  onChange: (items: string[]) => void;
  hasError?: boolean;
  "aria-describedby"?: string;
}

/**
 * A Tiptap-backed bullet-list input -- the first use of Tiptap in this
 * codebase. It exists purely as a nicer way to *type* a list of plain
 * strings (a custom talk's talking points, site hazards, and discussion
 * questions): press Enter for a new bullet, Backspace on an empty one to
 * merge with the previous -- both are ListItem's default keymap behavior, no
 * custom keymap code needed. `value`/`onChange` are plain `string[]`; see
 * the `extensions` comment above for why formatting is never possible.
 *
 * Uncontrolled after mount by design: `value` seeds the editor's initial
 * content only. The pages that use this always remount the whole form on
 * open (Modal doesn't render closed children, see ui_comps/modal/Modal.tsx),
 * so there's no case here where `value` needs to be pushed back into an
 * already-mounted editor from outside.
 */
export const BulletListEditor = ({
  id,
  value,
  onChange,
  hasError = false,
  "aria-describedby": ariaDescribedBy,
}: BulletListEditorProps) => {
  const editor = useEditor({
    extensions,
    content: stringsToBulletListDoc(value),
    onUpdate: ({ editor }) => {
      onChange(bulletListJsonToStrings(editor.getJSON()));
    },
  });

  return (
    <StyledEditorWrapper
      id={id}
      $hasError={hasError}
      aria-invalid={hasError}
      aria-describedby={ariaDescribedBy}
    >
      <EditorContent editor={editor} />
    </StyledEditorWrapper>
  );
};
