import { useEffect } from "react";
import { focusAndSelectElementById } from "../dom/focus";

export function useFocusAndSelectElementById(
  shouldFocus: boolean,
  elementId: string,
) {
  useEffect(() => {
    if (!shouldFocus) return;

    focusAndSelectElementById(elementId);
  }, [elementId, shouldFocus]);
}
