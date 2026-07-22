import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArchiveRestore,
  ClipboardPaste,
  ClipboardPlus,
  Command,
  Copy,
  CopyPlus,
  Download,
  Eye,
  FilePlus2,
  Paperclip,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { useQuickCapture } from "../hooks/useQuickCapture";
import { QUICK_CAPTURE_TEMPLATES } from "../templates";

type QuickCaptureController = ReturnType<typeof useQuickCapture>;

type QuickCaptureCommand = {
  id: string;
  group: string;
  label: string;
  description: string;
  keywords: string;
  shortcut?: string;
  Icon: LucideIcon;
  run: () => void | Promise<void>;
  available: boolean;
};

interface QuickCaptureCommandPaletteProps {
  open: boolean;
  capture: QuickCaptureController;
  preview: boolean;
  isSaving: boolean;
  shortcutModifier: string;
  onClose: () => void;
  onCreateNewNote: () => void;
  onFocusSearch: () => void;
  onSetPreview: (preview: boolean) => void;
  onPasteClipboard: () => void;
  onCaptureClipboard: () => void;
  onCopyClipboard: () => void;
  onExportMarkdown: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onInsertTemplate: (
    template: (typeof QUICK_CAPTURE_TEMPLATES)[number],
  ) => void;
  onRequestDelete: () => void;
}

export const QuickCaptureCommandPalette = ({
  open,
  capture,
  preview,
  isSaving,
  shortcutModifier,
  onClose,
  onCreateNewNote,
  onFocusSearch,
  onSetPreview,
  onPasteClipboard,
  onCaptureClipboard,
  onCopyClipboard,
  onExportMarkdown,
  onExportBackup,
  onImportBackup,
  onInsertTemplate,
  onRequestDelete,
}: QuickCaptureCommandPaletteProps) => {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const listId = useId();

  const commands = useMemo<QuickCaptureCommand[]>(
    () => [
      {
        id: "search",
        group: "移動",
        label: "保存済みメモを検索",
        description: "タグ、アーカイブ、添付条件を組み合わせて探します",
        keywords: "検索 find tag pinned archived attachment",
        shortcut: `${shortcutModifier}+F`,
        Icon: Search,
        run: onFocusSearch,
        available: true,
      },
      {
        id: "new-draft",
        group: "移動",
        label: "新しいメモを作成",
        description: "現在の内容を保存して、新しいメモを開きます",
        keywords: "下書き new draft",
        shortcut: `${shortcutModifier}+N`,
        Icon: Plus,
        run: onCreateNewNote,
        available: !isSaving,
      },
      {
        id: "preview",
        group: "編集",
        label: preview ? "編集モードに戻す" : "プレビューを表示",
        description: "Markdownを整形された表示で確認します",
        keywords: "編集 preview markdown 表示",
        Icon: Eye,
        run: () => onSetPreview(!preview),
        available: !isSaving,
      },
      {
        id: "save-note",
        group: "編集",
        label: "メモに保存",
        description: "下書きを保存済みメモへ変換します",
        keywords: "保存 save promote",
        shortcut: `${shortcutModifier}+Enter`,
        Icon: FilePlus2,
        run: () => void capture.promote(),
        available:
          !capture.activeId && Boolean(capture.content.trim()) && !isSaving,
      },
      {
        id: "paste",
        group: "編集",
        label: "クリップボードから貼り付け",
        description: "現在のカーソル位置へテキストを挿入します",
        keywords: "貼り付け paste clipboard",
        Icon: ClipboardPaste,
        run: onPasteClipboard,
        available: !preview && !isSaving,
      },
      {
        id: "capture-clipboard",
        group: "編集",
        label: "クリップボードを新しいメモとして保存",
        description: "クリップボードの本文をそのまま保存します",
        keywords: "即保存 clipboard capture save",
        Icon: ClipboardPlus,
        run: () => void onCaptureClipboard(),
        available: !isSaving,
      },
      {
        id: "duplicate",
        group: "整理",
        label: "メモを複製",
        description: "本文とタグを新しい下書きとして複製します",
        keywords: "複製 duplicate copy clone",
        shortcut: `${shortcutModifier}+Shift+D`,
        Icon: CopyPlus,
        run: () => void capture.duplicateActive(),
        available: Boolean(capture.activeId) && !isSaving,
      },
      ...QUICK_CAPTURE_TEMPLATES.map((template) => ({
        id: `template-${template.id}`,
        group: "テンプレート",
        label: `${template.label}テンプレートを挿入`,
        description: template.description,
        keywords: `テンプレート template ${template.tags.join(" ")}`,
        Icon: FilePlus2,
        run: () => onInsertTemplate(template),
        available: !preview && !isSaving,
      })),
      {
        id: "copy",
        group: "入出力",
        label: "本文をコピー",
        description: "現在の本文をクリップボードへコピーします",
        keywords: "コピー copy clipboard",
        Icon: Copy,
        run: () => void onCopyClipboard(),
        available: Boolean(capture.content.trim()),
      },
      {
        id: "export-markdown",
        group: "入出力",
        label: "Markdownとして書き出す",
        description: "本文とタグをMarkdownファイルへ保存します",
        keywords: "書き出し export markdown",
        Icon: Download,
        run: () => void onExportMarkdown(),
        available: Boolean(capture.content.trim()),
      },
      {
        id: "export-backup",
        group: "入出力",
        label: "バックアップを書き出す",
        description: "下書き、メモ、添付ファイルをまとめて保存します",
        keywords: "バックアップ backup export",
        Icon: Download,
        run: () => void onExportBackup(),
        available: !isSaving,
      },
      {
        id: "import-backup",
        group: "入出力",
        label: "バックアップから復元する",
        description: "現在のデータを選択したバックアップへ置き換えます",
        keywords: "復元 restore import backup",
        Icon: Upload,
        run: () => void onImportBackup(),
        available: !isSaving,
      },
      {
        id: "attach",
        group: "整理",
        label: "ファイルを添付",
        description: "現在の保存済みメモへ複数のファイルを追加します",
        keywords: "添付 attach file paperclip",
        Icon: Paperclip,
        run: () => void capture.addAttachment(),
        available: Boolean(capture.activeId) && !isSaving,
      },
      {
        id: "pin",
        group: "整理",
        label: capture.pinned ? "ピン留めを解除" : "ピン留め",
        description: "メモを一覧の上部へ固定します",
        keywords: "ピン pin favorite",
        shortcut: `${shortcutModifier}+Shift+P`,
        Icon: Pin,
        run: () => capture.setPinned(!capture.pinned),
        available: Boolean(capture.activeId) && !isSaving,
      },
      {
        id: "archive",
        group: "整理",
        label: capture.archived ? "アーカイブを解除" : "アーカイブ",
        description: "完了したメモを通常の一覧から整理します",
        keywords: "アーカイブ archive restore",
        shortcut: `${shortcutModifier}+Shift+A`,
        Icon: capture.archived ? ArchiveRestore : Archive,
        run: () => void capture.toggleArchived(),
        available: Boolean(capture.activeId) && !isSaving,
      },
      {
        id: "delete",
        group: "整理",
        label: "メモを削除",
        description: "確認後にメモを削除します。直後なら復元できます",
        keywords: "削除 delete trash remove",
        Icon: Trash2,
        run: onRequestDelete,
        available: Boolean(capture.activeId) && !isSaving,
      },
      {
        id: "retry",
        group: "復旧",
        label: capture.canRetryDuplicate ? "複製を再試行" : "保存を再試行",
        description: "前回失敗した操作を同じ内容で再実行します",
        keywords: "再試行 retry error recovery",
        Icon: RotateCcw,
        run: () =>
          void (capture.canRetryDuplicate
            ? capture.retryDuplicate()
            : capture.retrySave()),
        available:
          Boolean(capture.error) &&
          (capture.canRetrySave || capture.canRetryDuplicate) &&
          !isSaving,
      },
    ],
    [
      capture,
      isSaving,
      onCreateNewNote,
      onCaptureClipboard,
      onCopyClipboard,
      onExportBackup,
      onExportMarkdown,
      onFocusSearch,
      onImportBackup,
      onInsertTemplate,
      onPasteClipboard,
      onRequestDelete,
      onSetPreview,
      preview,
      shortcutModifier,
    ],
  );

  const availableCommands = useMemo(
    () =>
      commands
        .filter((command) => command.available)
        .filter((command) => {
          const normalizedQuery = query.trim().toLocaleLowerCase();
          if (!normalizedQuery) return true;
          return `${command.label} ${command.description} ${command.keywords}`
            .toLocaleLowerCase()
            .includes(normalizedQuery);
        }),
    [commands, query],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!paletteRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [onClose, open]);

  useEffect(() => {
    setCursor((current) =>
      availableCommands.length === 0
        ? 0
        : Math.min(current, availableCommands.length - 1),
    );
  }, [availableCommands.length]);

  if (!open) return null;

  const activeCommand = availableCommands[cursor] ?? null;
  const execute = (command: QuickCaptureCommand) => {
    onClose();
    void command.run();
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      return;
    }
    if (availableCommands.length === 0) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeCommand) execute(activeCommand);
      return;
    }
    const nextCursor =
      event.key === "ArrowDown"
        ? (cursor + 1) % availableCommands.length
        : event.key === "ArrowUp"
          ? (cursor - 1 + availableCommands.length) % availableCommands.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? availableCommands.length - 1
              : null;
    if (nextCursor === null) return;
    event.preventDefault();
    setCursor(nextCursor);
  };

  let previousGroup = "";
  return (
    <div className="quick-capture__command-backdrop">
      <section
        ref={paletteRef}
        className="quick-capture__command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="コマンドパレット"
        onKeyDown={handleKeyDown}
      >
        <header className="quick-capture__command-header">
          <div>
            <strong>
              <Command size={15} aria-hidden="true" /> コマンドパレット
            </strong>
            <span>操作を検索してEnterで実行</span>
          </div>
          <button
            type="button"
            aria-label="コマンドパレットを閉じる"
            onClick={onClose}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </header>
        <label className="quick-capture__command-search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="コマンドを検索"
            aria-controls={listId}
            aria-expanded="true"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-activedescendant={
              activeCommand ? `${listId}-${activeCommand.id}` : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder="操作を検索…"
          />
          <kbd>{shortcutModifier} K</kbd>
        </label>
        <div id={listId} className="quick-capture__command-list" role="listbox">
          {availableCommands.length > 0 ? (
            availableCommands.map((command, index) => {
              const showGroup = command.group !== previousGroup;
              previousGroup = command.group;
              const { Icon } = command;
              return (
                <div key={command.id}>
                  {showGroup && (
                    <p className="quick-capture__command-group">
                      {command.group}
                    </p>
                  )}
                  <button
                    id={`${listId}-${command.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === cursor}
                    className={index === cursor ? "is-active" : ""}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => execute(command)}
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span>
                      <strong>{command.label}</strong>
                      <small>{command.description}</small>
                    </span>
                    {command.shortcut && <kbd>{command.shortcut}</kbd>}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="quick-capture__command-empty">
              一致する操作がありません
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
