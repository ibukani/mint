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
import type { QuickCaptureNote, QuickCaptureSortMode } from "../types";
import { formatUpdatedAt, noteTitle } from "../utils";

const searchTerms = (query: string) =>
  [...new Set(query.toLocaleLowerCase().split(/\s+/).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );

const highlightSearchText = (text: string, query: string): React.ReactNode => {
  const terms = searchTerms(query);
  if (terms.length === 0) return text;

  const lowerText = text.toLocaleLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let start = lowerText.indexOf(term);
    while (start >= 0) {
      ranges.push([start, start + term.length]);
      start = lowerText.indexOf(term, start + term.length);
    }
  }
  if (ranges.length === 0) return text;

  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (cursor < start) parts.push(text.slice(cursor, start));
    parts.push(<mark key={`${start}-${end}`}>{text.slice(start, end)}</mark>);
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
};

const searchExcerpt = (
  content: string,
  title: string,
  query: string,
): string | null => {
  const terms = searchTerms(query);
  if (terms.length === 0) return null;
  const flattened = content.replace(/\s+/g, " ").trim();
  const lowerContent = flattened.toLocaleLowerCase();
  const lowerTitle = title.toLocaleLowerCase();
  const term = terms.find((candidate) => lowerContent.includes(candidate));
  if (!term || lowerTitle.includes(term)) return null;

  const matchIndex = lowerContent.indexOf(term);
  const start = Math.max(0, matchIndex - 28);
  const end = Math.min(flattened.length, matchIndex + term.length + 72);
  return `${start > 0 ? "…" : ""}${flattened.slice(start, end)}${end < flattened.length ? "…" : ""}`;
};

interface QuickCaptureLibraryProps {
  notes: QuickCaptureNote[];
  filteredNotes: QuickCaptureNote[];
  activeNotesCount: number;
  activeId: string | null;
  allTags: string[];
  searchText: string;
  sortMode: QuickCaptureSortMode;
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
  onSortChange: (sortMode: QuickCaptureSortMode) => void;
  onCursorChange: (id: string | null) => void;
  onSelectNote: (note: QuickCaptureNote) => void;
  onCopyNote: (note: QuickCaptureNote) => void;
  onRequestDelete: (note: QuickCaptureNote) => void;
}

export const QuickCaptureLibrary = ({
  notes,
  filteredNotes,
  activeNotesCount,
  activeId,
  allTags,
  searchText,
  sortMode,
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
  onSortChange,
  onCursorChange,
  onSelectNote,
  onCopyNote,
  onRequestDelete,
}: QuickCaptureLibraryProps) => {
  const hasRefinement = Boolean(
    query.trim() || tagFilter || pinnedOnly || attachmentsOnly || archivedOnly,
  );

  return (
    <aside
      className={`quick-capture__library${notes.length === 0 ? " is-empty" : ""}`}
      aria-label="保存済みメモ"
    >
      <div className="quick-capture__library-header">
        <strong>
          <Archive size={14} aria-hidden="true" /> 保存済みメモ
          <span className="quick-capture__library-count">{notes.length}</span>
        </strong>
        <div className="quick-capture__library-tools">
          <select
            className="quick-capture__sort-select"
            aria-label="メモの並び順"
            disabled={Boolean(searchText)}
            title={
              searchText
                ? "検索中は関連度順で表示しています"
                : "メモの並び順を変更"
            }
            value={sortMode}
            onChange={(event) =>
              onSortChange(event.target.value as QuickCaptureSortMode)
            }
          >
            <option value="updated">更新順</option>
            <option value="created">作成順</option>
            <option value="title">タイトル順</option>
          </select>
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
          aria-keyshortcuts={`${usesMetaShortcut ? "Meta+F" : "Control+F"} / ArrowDown ArrowUp Home End PageUp PageDown Enter Escape`}
          value={query}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="メモを検索"
        />
        <kbd
          className="quick-capture__search-shortcut"
          title={`検索へ移動（${shortcutModifier}+F）・↑↓: 1件移動・PageUp/PageDown: 5件移動`}
        >
          {shortcutModifier} F
        </kbd>
      </label>
      <div className="quick-capture__search-meta" aria-live="polite">
        <span>
          {hasRefinement
            ? `${filteredNotes.length}件`
            : `${filteredNotes.length}件表示`}
        </span>
        {searchText && <span>関連度順</span>}
      </div>
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
          aria-label={`未アーカイブのメモ（${activeNotesCount}件）`}
          aria-pressed={
            !pinnedOnly && !attachmentsOnly && !archivedOnly && !tagFilter
          }
          onClick={onClearFilters}
        >
          すべて
          <span aria-hidden="true">{activeNotesCount}</span>
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
            const excerpt = searchExcerpt(note.content, title, searchText);
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
                    <strong>{highlightSearchText(title, searchText)}</strong>
                  </span>
                  <small>{formatUpdatedAt(note.updatedAt)}</small>
                  {excerpt && (
                    <small className="quick-capture__note-excerpt">
                      {highlightSearchText(excerpt, searchText)}
                    </small>
                  )}
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
              {hasRefinement
                ? "一致するメモがありません"
                : activeNotesCount === 0 && archivedCount > 0
                  ? "受信箱は空です"
                  : "まだメモはありません"}
            </strong>
            <span>
              {hasRefinement
                ? "検索条件を変えてみてください"
                : activeNotesCount === 0 && archivedCount > 0
                  ? "アーカイブしたメモから、必要なものを戻せます"
                  : `${shortcutModifier}+Enterで保存すると、ここからすぐ開けます`}
            </span>
            {!hasRefinement && activeNotesCount === 0 && archivedCount > 0 && (
              <button
                type="button"
                className="quick-capture__empty-action"
                onClick={onToggleArchivedOnly}
              >
                アーカイブを表示
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
