let locks = [];

const preventBackgroundScroll = (event) => {
  if (locks.some((allowedElement) => !allowedElement || !allowedElement.contains(event.target))) event.preventDefault();
};

export const lockPageScroll = (allowedElement = null) => {
  locks.push(allowedElement);
  if (locks.length === 1) {
    document.documentElement.classList.add("page-scroll-locked");
    document.addEventListener("wheel", preventBackgroundScroll, { capture: true, passive: false });
  }
  return () => {
    const index = locks.indexOf(allowedElement);
    if (index >= 0) locks.splice(index, 1);
    if (!locks.length) {
      document.documentElement.classList.remove("page-scroll-locked");
      document.removeEventListener("wheel", preventBackgroundScroll, true);
    }
  };
};

window.lockPageScroll = lockPageScroll;
