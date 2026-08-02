import type { FileShelfPort } from "../../core/actions/ports";
import { loadFileShelfState } from "./api";

/**
 * Public file-shelf port. Exposes read access to shelf items so cross-feature
 * actions can resolve item ids without touching the shelf UI or repository.
 */
export const fileShelfPort: FileShelfPort = {
  async getItem(itemId) {
    const state = await loadFileShelfState();
    for (const group of state.groups) {
      const item = group.items.find((candidate) => candidate.id === itemId);
      if (item) return item;
    }
    return null;
  },
};
