import {
  Archive,
  Copy,
  Download,
  Paperclip,
  Pin,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type React from "react";
import type { RefObject } from "react";
import type { QuickCaptureNote } from "../types";
import { formatUpdatedAt, noteTitle } from "../utils";

interface QuickCaptureLibraryProps {
  notes: QuickCaptureNote[];
  filteredNotes: QuickCaptureNote[];
  activeId: string | null;
  allTags: string[];
  pinnedCount: number;
  attachmentCount: number;
  archivedCount: number;
  query: string;
  tagFilter: string | null;
  pinnedOnly: boolean;
  attachmentsOnly: boolean;
  archivedOnly: boolean;
  cursorNote: QuickCaptureNote | null;
  searchFocused: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  noteListRef: RefObject<HTMLDivElement | null>;
  noteListId: string;
  shortcutModifier: string;
  usesMetaShortcut: boolean;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onQueryChange: (query: string) => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onClearFilters: () => void;
  onTogglePinnedOnly: () => void;
  onToggleAttachmentsOnly: () => void;
  onToggleArchivedOnly: () => void;
  onToggleTag: (tag: string) => void;
  onCursorChange: (id: string | null) => void;
  onSelectNote: (note: QuickCaptureNote) => void;
  onCopyNote: (note: QuickCaptureNote) => void;
  onRequestDelete: (note: QuickCaptureNote) => void;
}

export const QuickCaptureLibrary = ({
  notes,
  filteredNotes,
  activeId,
  allTags,
  pinnedCount,
  attachmentCount,
  archivedCount,
  query,
  tagFilter,
  pinnedOnly,
  attachmentsOnly,
  archivedOnly,
  cursorNote,
  searchFocused,
  searchRef,
  noteListRef,
  noteListId,
  shortcutModifier,
  usesMetaShortcut,
  onExportBackup,
  onImportBackup,
  onSearchFocus,
  onSearchBlur,
  onQueryChange,
  onSearchKeyDown,
  onClearFilters,
  onTogglePinnedOnly,
  onToggleAttachmentsOnly,
  onToggleArchivedOnly,
  onToggleTag,
  onCursorChange,
  onSelectNote,
  onCopyNote,
  onRequestDelete,
}: QuickCaptureLibraryProps) => (
  <aside
    className={`quick-capture__library${notes.length === 0 ? " is-empty" : ""}`}
    aria-label="保存済みメモ"
  >
    <div className="quick-capture__library-header">
      <strong>
        <Archive size={14} aria-hidden="true" /> 保存済みメモ
        <span className="quick-capture__library-count">{notes.length}</span>
      </strong>
      <div>
        <button
          type="button"
          aria-label="バックアップを書き出す"
          title="バックアップを書き出す"
          onClick={onExportBackup}
        >
          <Download size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="バックアップから復元する"
          title="バックアップから復元する"
          onClick={onImportBackup}
        >
          <Upload size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
    <label className="quick-capture__search">
      <Search size={14} aria-hidden="true" />
      <input
        ref={searchRef}
        role="combobox"
        aria-label="保存済みメモを検索"
        title="高度な検索: tag:タグ / is:pinned / is:archived / has:attachment"
        aria-controls={noteListId}
        aria-expanded="true"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={
          searchFocused && cursorNote
            ? `${noteListId}-${cursorNote.id}`
            : undefined
        }
        aria-keyshortcuts={`${usesMetaShortcut ? "Meta+F Meta+K" : "Control+F Control+K"} / ArrowDown ArrowUp Home End PageUp PageDown Enter Escape`}
        value={query}
        onFocus={onSearchFocus}
        onBlur={onSearchBlur}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onSearchKeyDown}
        placeholder="メモを検索"
      />
      <kbd
        className="quick-capture__search-shortcut"
        title={`検索へ移動（${shortcutModifier}+F / ${shortcutModifier}+K）・↑↓: 1件移動・PageUp/PageDown: 5件移動`}
      >
        {shortcutModifier} F / K
      </kbd>
    </label>
    <fieldset
      className="quick-capture__library-filters"
      aria-label="メモの絞り込み"
    >
      <button
        type="button"
        className={
          !pinnedOnly && !attachmentsOnly && !archivedOnly && !tagFilter
            ? "is-active"
            : ""
        }
        aria-label={`すべてのメモ（${notes.length}件）`}
        aria-pressed={
          !pinnedOnly && !attachmentsOnly && !archivedOnly && !tagFilter
        }
        onClick={onClearFilters}
      >
        すべて
        <span aria-hidden="true">{notes.length}</span>
      </button>
      <button
        type="button"
        className={pinnedOnly ? "is-active" : ""}
        aria-label={`ピン留めしたメモ（${pinnedCount}件）`}
        aria-pressed={pinnedOnly}
        onClick={onTogglePinnedOnly}
      >
        <Pin size={11} aria-hidden="true" />
        ピン留め
        <span aria-hidden="true">{pinnedCount}</span>
      </button>
      <button
        type="button"
        className={attachmentsOnly ? "is-active" : ""}
        aria-label={`添付ファイル付きメモ（${attachmentCount}件）`}
        aria-pressed={attachmentsOnly}
        onClick={onToggleAttachmentsOnly}
      >
        <Paperclip size={11} aria-hidden="true" />
        添付あり
        <span aria-hidden="true">{attachmentCount}</span>
      </button>
      <button
        type="button"
        className={archivedOnly ? "is-active" : ""}
        aria-label={`アーカイブしたメモ（${archivedCount}件）`}
        aria-pressed={archivedOnly}
        onClick={onToggleArchivedOnly}
      >
        <Archive size={11} aria-hidden="true" />
        アーカイブ
        <span aria-hidden="true">{archivedCount}</span>
      </button>
      {allTags.map((tag) => (
        <button
          type="button"
          key={tag}
          className={tagFilter === tag ? "is-active" : ""}
          aria-pressed={tagFilter === tag}
          onClick={() => onToggleTag(tag)}
        >
          #{tag}
        </button>
      ))}
    </fieldset>
    <div
      id={noteListId}
      ref={noteListRef}
      className="quick-capture__notes"
      role="listbox"
      aria-label="保存済みメモ"
    >
      {filteredNotes.length ? (
        filteredNotes.map((note) => {
          const title = noteTitle(note);
          return (
            <div className="quick-capture__note-row" key={note.id}>
              <button
                type="button"
                role="option"
                id={`${noteListId}-${note.id}`}
                tabIndex={-1}
                className={`quick-capture__note${activeId === note.id ? " is-active" : ""}${searchFocused && cursorNote?.id === note.id ? " is-keyboard-active" : ""}`}
                aria-selected={activeId === note.id}
                onMouseEnter={() => onCursorChange(note.id)}
                onClick={() => onSelectNote(note)}
              >
                <span className="quick-capture__note-title">
                  {note.pinned && <Pin size={11} aria-label="ピン留め済み" />}
                  {note.archived && (
                    <Archive size={11} aria-label="アーカイブ済み" />
                  )}
                  <strong>{title}</strong>
                </span>
                <small>{formatUpdatedAt(note.updatedAt)}</small>
                {note.tags.length > 0 && (
                  <span>{note.tags.map((tag) => `#${tag}`).join(" ")}</span>
                )}
              </button>
              <div className="quick-capture__note-actions">
                <button
                  type="button"
                  aria-label={`「${title}」をコピー`}
                  title="メモ本文をコピー"
                  onClick={() => onCopyNote(note)}
                >
                  <Copy size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="quick-capture__note-delete"
                  aria-label={`「${title}」を削除`}
                  title="メモを削除"
                  onClick={() => onRequestDelete(note)}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="quick-capture__empty">
          <Archive size={20} aria-hidden="true" />
          <strong>
            {query || tagFilter || pinnedOnly || attachmentsOnly || archivedOnly
              ? "一致するメモがありません"
              : "まだメモはありません"}
          </strong>
          <span>
            {query || tagFilter || pinnedOnly || attachmentsOnly || archivedOnly
              ? "検索条件を変えてみてください"
              : `${shortcutModifier}+Enterで保存すると、ここからすぐ開けます`}
          </span>
        </div>
      )}
    </div>
  </aside>
);
