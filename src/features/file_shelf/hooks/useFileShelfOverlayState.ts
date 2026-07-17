import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileShelfGroup, FileShelfItem } from "../types";
import { fileShelfSearchText } from "../utils";

export type ShelfCursorEntry =
  | { key: string; kind: "group"; groupId: string }
  | { key: string; kind: "item"; item: FileShelfItem };

interface FileShelfOverlayStateOptions {
  groups: FileShelfGroup[];
}

export const useFileShelfOverlayState = ({
  groups,
}: FileShelfOverlayStateOptions) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [cursorKey, setCursorKey] = useState("");
  const knownGroupIds = useRef<Set<string> | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");

  const allItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups],
  );
  const searchTextByItemId = useMemo(
    () => new Map(allItems.map((item) => [item.id, fileShelfSearchText(item)])),
    [allItems],
  );
  const visibleGroups = useMemo(
    () =>
      normalizedQuery
        ? groups.flatMap((group) => {
            const items = group.items.filter((item) =>
              searchTextByItemId.get(item.id)?.includes(normalizedQuery),
            );
            return items.length ? [{ ...group, items }] : [];
          })
        : groups,
    [groups, normalizedQuery, searchTextByItemId],
  );
  const visibleItems = useMemo(
    () => visibleGroups.flatMap((group) => group.items),
    [visibleGroups],
  );
  const cursorEntries = useMemo(
    () =>
      visibleGroups.flatMap<ShelfCursorEntry>((group) => {
        if (group.items.length === 1) {
          const item = group.items[0];
          return [{ key: `item:${item.id}`, kind: "item", item }];
        }
        const itemEntries = group.items.map<ShelfCursorEntry>((item) => ({
          key: `item:${item.id}`,
          kind: "item",
          item,
        }));
        if (normalizedQuery) return itemEntries;
        const groupEntry: ShelfCursorEntry = {
          key: `group:${group.id}`,
          kind: "group",
          groupId: group.id,
        };
        return expandedGroups.has(group.id)
          ? [groupEntry, ...itemEntries]
          : [groupEntry];
      }),
    [expandedGroups, normalizedQuery, visibleGroups],
  );

  useEffect(() => {
    const activeIds = new Set(allItems.map((item) => item.id));
    setSelectedIds(
      (previous) => new Set([...previous].filter((id) => activeIds.has(id))),
    );
  }, [allItems]);

  useEffect(() => {
    const nextIds = new Set(groups.map((group) => group.id));
    if (knownGroupIds.current) {
      const addedStackIds = groups
        .filter(
          (group) =>
            group.items.length > 1 && !knownGroupIds.current?.has(group.id),
        )
        .map((group) => group.id);
      if (addedStackIds.length) {
        setExpandedGroups(
          (previous) => new Set([...previous, ...addedStackIds]),
        );
      }
    }
    knownGroupIds.current = nextIds;
  }, [groups]);

  useEffect(() => {
    setCursorKey((previous) =>
      cursorEntries.some((entry) => entry.key === previous)
        ? previous
        : (cursorEntries[0]?.key ?? ""),
    );
  }, [cursorEntries]);

  const selectItem = useCallback(
    (item: FileShelfItem, additive: boolean) => {
      const next = new Set(additive ? selectedIds : []);
      if (additive && next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      setSelectedIds(next);
      setCursorKey(`item:${item.id}`);
    },
    [selectedIds],
  );

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const moveCursor = useCallback(
    (nextIndex: number) => {
      const entry = cursorEntries[nextIndex];
      if (!entry) return;
      setCursorKey(entry.key);
      setSelectedIds(
        entry.kind === "item" ? new Set([entry.item.id]) : new Set(),
      );
    },
    [cursorEntries],
  );

  const selectedItems = useMemo(
    () => allItems.filter((item) => selectedIds.has(item.id)),
    [allItems, selectedIds],
  );
  const removableSelectedItems = useMemo(
    () => selectedItems.filter((item) => !item.pinned),
    [selectedItems],
  );

  return {
    allItems,
    cursorEntries,
    cursorKey,
    expandedGroups,
    moveCursor,
    normalizedQuery,
    query,
    removableSelectedItems,
    selectItem,
    selectedIds,
    selectedItems,
    setSelectedIds,
    setQuery,
    toggleGroup,
    visibleGroups,
    visibleItems,
  };
};
