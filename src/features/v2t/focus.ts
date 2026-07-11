export const focusAndSelect = (id: string) => {
  const element = document.getElementById(id);
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    element.focus();
    element.select();
  }
};
