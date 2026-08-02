import { createEventFromNoteAction } from "./crossFeature/create-event-from-note";
import { saveShelfItemAsNoteAction } from "./crossFeature/save-shelf-item-as-note";
import { transcribeShelfAudioAction } from "./crossFeature/transcribe-shelf-audio";
import type { CrossFeatureActionRecord } from "./types";

/**
 * Static registry of every cross-feature action. Adding a new integration
 * means adding a new entry here; the registry stays free of dynamic
 * dispatchers and stringly-typed command routing.
 */
export const CROSS_FEATURE_ACTIONS: readonly CrossFeatureActionRecord[] = [
  saveShelfItemAsNoteAction,
  transcribeShelfAudioAction,
  createEventFromNoteAction,
];

export const getCrossFeatureAction = (
  actionId: string,
): CrossFeatureActionRecord | undefined =>
  CROSS_FEATURE_ACTIONS.find((action) => action.id === actionId);
