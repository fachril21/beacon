"use client";

/**
 * A single `<input type="file">` appended directly to `document.body`,
 * entirely outside any React tree. BlockNote's dev-mode NodeView remount
 * (see screenshot-block.tsx — recreates the screenshot block's whole
 * subtree roughly once a second, dev-only) tears down and recreates any
 * `<input>` that a block-owned component renders locally. Picking a file
 * from the native OS dialog realistically takes several seconds, so a
 * locally-owned input gets replaced mid-dialog and the resulting `change`
 * event fires on an orphaned node no live React handler is listening to —
 * silently dropping the upload. Living outside the remounting subtree, this
 * input's identity survives regardless of what happens to the component
 * that requested it.
 */

let inputEl: HTMLInputElement | null = null;
let pendingCallback: ((file: File) => void) | null = null;

function ensureInput(): HTMLInputElement {
  if (inputEl && document.body.contains(inputEl)) return inputEl;

  const el = document.createElement("input");
  el.type = "file";
  el.accept = "image/*";
  el.style.display = "none";
  el.addEventListener("change", () => {
    const file = el.files?.[0];
    el.value = "";
    const callback = pendingCallback;
    pendingCallback = null;
    if (file && callback) callback(file);
  });
  document.body.appendChild(el);
  inputEl = el;
  return el;
}

/** Opens the OS file picker and invokes `onSelect` with the chosen image file. */
export function requestImageFile(onSelect: (file: File) => void): void {
  const input = ensureInput();
  pendingCallback = onSelect;
  input.click();
}
