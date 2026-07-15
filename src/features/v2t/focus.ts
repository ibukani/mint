import { revealElementVertically } from "../../design/layout/scrollVisibility";

export const focusAndSelect = (id: string) => {
  const element = document.getElementById(id);
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    element.focus({ preventScroll: true });
    element.select();
    const scrollContainer = element.closest<HTMLElement>(".app-content");
    if (scrollContainer) {
      revealElementVertically(scrollContainer, element, 24);
    }
  }
};
