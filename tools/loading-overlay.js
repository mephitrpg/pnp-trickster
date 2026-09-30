import { tr } from "../app-core.js";
import { lockPageScroll } from "./scroll-lock.js";

let activeLoaders = 0;

const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const overlay = (message) => {
  const element = document.createElement("div");
  element.className = "loading-overlay";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "assertive");
  element.innerHTML = `<div class="loading-indicator"><span class="loading-spinner" aria-hidden="true"></span><span>${message}</span></div>`;
  document.body.append(element);
  element.releaseScrollLock = lockPageScroll();
  return element;
};

export async function withLoading(task, message = tr("processing")) {
  const existing = document.querySelector(".loading-overlay");
  const element = existing || overlay(message);
  activeLoaders += 1;
  await nextPaint();
  try {
    return await task();
  } finally {
    activeLoaders -= 1;
    if (!activeLoaders) { element.releaseScrollLock(); element.remove(); }
  }
}

window.withLoading = withLoading;
