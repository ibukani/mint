import { CircleAlert, LoaderCircle } from "lucide-react";
import type React from "react";
import { useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import "./ConfirmDialog.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  error?: string;
  tone?: "primary" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}

const focusableSelector = [
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let openDialogCount = 0;

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "キャンセル",
  busy = false,
  busyLabel = "処理しています…",
  error = "",
  tone = "danger",
  onCancel,
  onConfirm,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const wasBusyRef = useRef(false);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const restoreTarget =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    openDialogCount += 1;
    document.body.classList.add("has-design-confirm-dialog");
    const dialogNode = dialogRef.current;
    const backgroundNodes = Array.from(document.body.children)
      .filter((element) => !element.contains(dialogNode))
      .filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      )
      .map((element) => ({
        element,
        inert: element.inert,
        inertAttribute: element.hasAttribute("inert"),
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
    for (const { element } of backgroundNodes) {
      element.setAttribute("inert", "");
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    cancelButtonRef.current?.focus();

    return () => {
      for (const {
        element,
        inert,
        inertAttribute,
        ariaHidden,
      } of backgroundNodes) {
        if (inertAttribute) element.setAttribute("inert", "");
        else element.removeAttribute("inert");
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      openDialogCount = Math.max(0, openDialogCount - 1);
      if (openDialogCount === 0) {
        document.body.classList.remove("has-design-confirm-dialog");
      }
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus();
      }
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      wasBusyRef.current = false;
      return;
    }
    if (busy) {
      wasBusyRef.current = true;
      dialogRef.current?.focus();
    } else if (wasBusyRef.current) {
      wasBusyRef.current = false;
      if (error) confirmButtonRef.current?.focus();
    }
  }, [busy, error, open]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (!busy) onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return createPortal(
    <div className="design-confirm-dialog__backdrop" data-window-drag-block>
      <button
        type="button"
        className="design-confirm-dialog__dismiss"
        tabIndex={-1}
        aria-hidden="true"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        className={`design-confirm-dialog is-${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={[descriptionId, error ? errorId : ""]
          .filter(Boolean)
          .join(" ")}
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="design-confirm-dialog__heading">
          <span className="design-confirm-dialog__icon" aria-hidden="true">
            <CircleAlert size={19} />
          </span>
          <div>
            <h2 id={titleId}>{title}</h2>
            <div
              id={descriptionId}
              className="design-confirm-dialog__description"
            >
              {description}
            </div>
          </div>
        </div>

        {error && (
          <p id={errorId} className="design-confirm-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="design-confirm-dialog__actions">
          <Button
            ref={cancelButtonRef}
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={tone}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && (
              <LoaderCircle
                className="design-confirm-dialog__spinner"
                size={15}
                aria-hidden="true"
              />
            )}
            {busy ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
