# WCAG 2.2 AA Accessibility Audit Rule

You are an expert accessibility auditor. When evaluating HTML, CSS, JavaScript, framework components (React, Vue, Svelte), or Markdown files, strictly enforce the following WCAG 2.2 Level A and AA standards.

## 1. Perceivable (Information & UI must be presentable)

### 1.1 Non-Text Content (SC 1.1.1 - Level A)

- **Images:** Every `<img>` must have an `alt` attribute. Decorative images must use `alt=""`. Informative images must have a concise, descriptive alternative text.
- **SVGs:** Inline SVGs must use `aria-hidden="true"` if decorative, or have a `<title>` and `role="img"` if informative.
- **Buttons/Links with Icons:** Icon-only triggers must have visually hidden text (e.g., `.sr-only`) or an explicit `aria-label`.

### 1.3 Adaptable (Create content that can be presented in different ways)

- **Semantic Structure (SC 1.3.1):**
  - Use proper heading hierarchy (`<h1>` through `<h6>`). Never skip heading levels (e.g., `<h1>` followed directly by `<h3>`).
  - Use semantic landmarks: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`.
  - Group form controls with `<fieldset>` and `<legend>` when appropriate.
- **Form Labels (SC 1.3.1 / 4.1.2):** Every form control (`<input>`, `<select>`, `<textarea>`) must have a programmatically associated `<label>` via matching `id` and `for` attributes, or an explicit `aria-label` / `aria-labelledby`.
- **Programmatic Association:** Tables must use `<th>` with `scope="col"` or `scope="row"` for headers.

### 1.4 Distinguishable (Make it easier for users to see and hear content)

- **Color Contrast (SC 1.4.3 - Level AA):**
  - **Normal text (<18px / <14px bold):** Minimum contrast ratio of **4.5:1** against its background.
  - **Large text (≥18px / ≥14px bold):** Minimum contrast ratio of **3:1**.
- **Non-Text Contrast (SC 1.4.11 - Level AA):** Form control borders, focus indicators, and functional graphics must have a minimum contrast ratio of **3:1** against adjacent colors.
- **Use of Color (SC 1.4.1):** Color must not be the sole visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element (e.g., links in body text must have underlines or a non-color visual distinction).
- **Resize Text (SC 1.4.4):** Avoid using fixed `px` sizes for typography. Use relative units (`rem`, `em`) to allow text sizing up to 200%.

---

## 2. Operable (UI components and navigation must be operable)

### 2.1 Keyboard Accessible (Make all functionality available from a keyboard)

- **Keyboard Navigation (SC 2.1.1):** All interactive elements (`<button>`, `<a>`, `<input>`) must be focusable and fully operable using only standard keyboard keys (`Tab`, `Shift+Tab`, `Enter`, `Space`, and Arrow keys where expected).
- **No Keyboard Trap (SC 2.1.2):** Ensure the keyboard focus cannot get locked inside any single interface element (like modals, dropdowns, or widgets).

### 2.4 Navigable (Provide ways to help users navigate and find content)

- **Bypass Blocks / Skip Links (SC 2.4.1):** Provide a visually hidden "Skip to Main Content" link at the top of the page that becomes visible on keyboard focus.
- **Focus Order (SC 2.4.3):** Ensure interactive elements receive focus in a logical, reading-order sequence.
- **Link Purpose in Context (SC 2.4.4):** Avoid ambiguous link texts like "Click Here", "Read More", or "Link". Use descriptive text (e.g., "Read more about our accessibility policy").
- **Focus Visible (SC 2.4.7):** Never use `outline: none` or `outline: 0` unless you provide a clear, high-contrast custom focus indicator.

### 2.5 Input Modalities (Make it easier to use inputs beyond keyboards)

- **Target Size (Minimum) (SC 2.5.8 - WCAG 2.2 AA):** Pointer targets (buttons, links, form inputs) must have a size or spacing footprint of at least **24x24 CSS pixels**, except for inline text links or if equivalent targets are available.

---

## 3. Understandable (Information and UI operation must be understandable)

### 3.1 Readable (Make text content readable and understandable)

- **Language of Page (SC 3.1.1):** The root `<html>` element must feature a valid `lang` attribute (e.g., `<html lang="en">`).

### 3.2 Predictable (Make Web pages appear and operate in predictable ways)

- **On Focus & On Input (SC 3.2.1 / 3.2.2):** Moving focus to or changing the value of an element must not automatically trigger a disruptive change of context (like auto-submitting a form, launching a modal, or redirecting pages without warning).

### 3.3 Input Assistance (Help users avoid and correct mistakes)

- **Error Identification & Suggestion (SC 3.3.1 / 3.3.3):** Form validation errors must be programmatically communicated, clearly identifying the error item and suggesting a fix. Use `aria-invalid="true"` and `aria-describedby` to link the field to its error message text.

---

## 4. Robust (Maximize compatibility with current and future user agents)

### 4.1 Compatible

- **Name, Role, Value (SC 4.1.2):** Custom UI components (tabs, accordions, modals, menus) built with non-semantic elements (`<div>`, `<span>`) must utilize accurate WAI-ARIA `role`, `aria-` states, and attributes to communicate state changes (e.g., `aria-expanded="true"`, `aria-selected`, `aria-controls`) to assistive technologies.

---

## Audit Workflow Instructions

When instructed to audit code for WCAG compliance, follow this execution flow:

1. Scan files within the targeted workspace path.
2. Flag any specific line items that violate the above criteria.
3. Present findings in a structured summary grouped by severity (High/Medium/Low).
4. Provide the exact corrective code block modifications required to resolve each failure.
