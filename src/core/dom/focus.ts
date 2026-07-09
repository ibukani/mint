type FocusSelectableElement = HTMLElement & {
  focus: () => void;
  select: () => void;
};

const isFocusSelectableElement = (
  element: HTMLElement | null,
): element is FocusSelectableElement =>
  Boolean(
    element &&
      typeof element.focus === "function" &&
      typeof (element as Partial<FocusSelectableElement>).select === "function",
  );

export const focusAndSelectElementById = (id: string) => {
  const element = document.getElementById(id);
  if (!isFocusSelectableElement(element)) return;

  element.focus();
  element.select();
};
