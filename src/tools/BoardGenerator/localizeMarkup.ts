import type { Translator } from "../../localization";

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

// Preserve English source strings when the user switches language.
export function localizeMarkup(root: Element, t: Translator) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const source = originalText.get(node) ?? node.textContent ?? "";
    const key = source.trim();
    if (!key || (t(key) === key && !originalText.has(node))) continue;
    originalText.set(node, source);
    const translated = source.replace(key, t(key));
    if (node.textContent !== translated) node.textContent = translated;
  }
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const name of ["aria-label", "placeholder", "title"]) {
      const current = element.getAttribute(name);
      if (current === null) continue;
      let originals = originalAttributes.get(element);
      const source = originals?.get(name) ?? current;
      if (t(source) === source && !originals?.has(name)) continue;
      if (!originals) {
        originals = new Map();
        originalAttributes.set(element, originals);
      }
      originals.set(name, source);
      const translated = t(source);
      if (current !== translated) element.setAttribute(name, translated);
    }
  }
}
