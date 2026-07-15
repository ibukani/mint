import { Pencil, X } from "lucide-react";
import type { RefObject } from "react";

interface FileShelfRenameFormProps {
  name: string;
  busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const FileShelfRenameForm = ({
  name,
  busy,
  inputRef,
  onNameChange,
  onSubmit,
  onCancel,
}: FileShelfRenameFormProps) => (
  <form
    className="file-shelf__rename"
    aria-label="棚での表示名を変更"
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <Pencil size={15} aria-hidden="true" />
    <input
      ref={inputRef}
      value={name}
      maxLength={120}
      aria-label="棚で表示する名前"
      onChange={(event) => onNameChange(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    />
    <button type="submit" disabled={busy || !name.trim()}>
      保存
    </button>
    <button
      type="button"
      onClick={onCancel}
      aria-label="名前の変更をキャンセル"
    >
      <X size={15} aria-hidden="true" />
    </button>
  </form>
);
