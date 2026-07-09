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

export const focusAndSelectElement = (element: HTMLElement | null) => {
  if (!isFocusSelectableElement(element)) return;

  element.focus();
  element.select();
};

export const focusAndSelectElementById = (id: string) => {
  focusAndSelectElement(document.getElementById(id));
};
