import type { VoiceToTextPort } from "../../core/actions/ports";
import { isSupportedAudioFilePath, openV2tWithAudioFile } from "./api";

/**
 * Public Voice to Text port. Keeps audio-format knowledge inside the feature
 * and delegates the "open with a file" flow to the window-level command.
 */
export const voiceToTextPort: VoiceToTextPort = {
  isSupportedAudioPath: isSupportedAudioFilePath,
  openWithAudioFile: (path) => openV2tWithAudioFile(path),
};
