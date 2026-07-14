export const revealElementVertically = (
  container: HTMLElement,
  element: HTMLElement,
  padding = 0,
) => {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const visibleTop = containerRect.top + padding;
  const visibleBottom = containerRect.bottom - padding;

  if (elementRect.top < visibleTop) {
    container.scrollTop -= visibleTop - elementRect.top;
  } else if (elementRect.bottom > visibleBottom) {
    container.scrollTop += elementRect.bottom - visibleBottom;
  }
};
