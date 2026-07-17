import type {
  SidebarQuickAction,
  SidebarSearchItem,
  SidebarTab,
} from "./Sidebar";

export type SettingsSearchResult<TTabId extends string> =
  | {
      kind: "tab";
      key: string;
      tab: SidebarTab<TTabId>;
    }
  | {
      kind: "setting";
      key: string;
      item: SidebarSearchItem;
      tab: SidebarTab<TTabId>;
    }
  | {
      kind: "action";
      key: string;
      action: SidebarQuickAction<TTabId>;
    };

const normalizeSearchText = (value: string) =>
  value.toLocaleLowerCase("ja").replace(/\s+/g, "");

const searchText = (values: readonly (string | undefined)[]) =>
  normalizeSearchText(values.filter(Boolean).join(" "));

const createTabResult = <TTabId extends string>(
  tab: SidebarTab<TTabId>,
): SettingsSearchResult<TTabId> => ({
  kind: "tab",
  key: `tab:${tab.id}`,
  tab,
});

const createActionResult = <TTabId extends string>(
  action: SidebarQuickAction<TTabId>,
): SettingsSearchResult<TTabId> => ({
  kind: "action",
  key: `action:${action.id}`,
  action,
});

export const buildSettingsSearchResults = <TTabId extends string>(
  tabs: readonly SidebarTab<TTabId>[],
  quickActions: readonly SidebarQuickAction<TTabId>[],
  query: string,
  recentKeys: readonly string[],
) => {
  const normalizedQuery = normalizeSearchText(query);
  const tabSearchIndex = tabs.map((tab) => ({
    tab,
    text: searchText([
      tab.label,
      tab.navigationLabel,
      tab.description,
      ...(tab.keywords ?? []),
    ]),
    items: (tab.searchItems ?? []).map((item) => ({
      item,
      text: searchText([
        item.label,
        item.description,
        ...(item.keywords ?? []),
      ]),
    })),
  }));
  const actionSearchIndex = quickActions.map((action) => ({
    action,
    text: searchText([
      action.label,
      action.description,
      ...(action.keywords ?? []),
    ]),
  }));

  const filteredResults = normalizedQuery
    ? [
        ...tabSearchIndex.flatMap<SettingsSearchResult<TTabId>>(
          ({ tab, text, items }) => {
            const results: SettingsSearchResult<TTabId>[] = [];
            if (text.includes(normalizedQuery))
              results.push(createTabResult(tab));
            for (const { item, text: itemText } of items) {
              if (itemText.includes(normalizedQuery)) {
                results.push({
                  kind: "setting",
                  key: `setting:${tab.id}:${item.id}`,
                  item,
                  tab,
                });
              }
            }
            return results;
          },
        ),
        ...actionSearchIndex
          .filter(({ text }) => text.includes(normalizedQuery))
          .map(({ action }) => createActionResult(action)),
      ]
    : [
        ...tabSearchIndex.map(({ tab }) => createTabResult(tab)),
        ...actionSearchIndex.map(({ action }) => createActionResult(action)),
      ];

  const recentResults = normalizedQuery
    ? []
    : recentKeys.flatMap((key) => {
        const result = filteredResults.find(
          (candidate) => candidate.key === key,
        );
        return result ? [result] : [];
      });
  const recentResultKeys = new Set(recentResults.map((result) => result.key));
  const orderedResults = recentResults.length
    ? [
        ...recentResults,
        ...filteredResults.filter(
          (result) => !recentResultKeys.has(result.key),
        ),
      ]
    : filteredResults;

  return { normalizedQuery, orderedResults, recentResults, recentResultKeys };
};
