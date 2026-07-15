import { useCallback, useState } from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import { focusAndSelect } from "../focus";
import { useTranscriptionWorkbench } from "./useTranscriptionWorkbench";
import { useVoiceToTextApiKey } from "./useVoiceToTextApiKey";

export const useVoiceToTextController = () => {
  const {
    featureSettings: voiceToText,
    handleChange,
    updateFeatureSettings,
    shortcutError,
  } = useFeatureSettings("voiceToText");
  const [baseUrlError, setBaseUrlError] = useState("");
  const [modelError, setModelError] = useState("");
  const [languageError, setLanguageError] = useState("");
  const apiKeyController = useVoiceToTextApiKey();

  const clearApiKeyPasteStatus = useCallback(
    () => apiKeyController.setApiKeyPasteStatus(""),
    [apiKeyController.setApiKeyPasteStatus],
  );

  const transcriptionController = useTranscriptionWorkbench({
    settings: voiceToText ?? defaultAppSettings.voiceToText,
    apiKey: apiKeyController.apiKey,
    apiKeyLoaded: apiKeyController.apiKeyLoaded,
    clearApiKeyPasteStatus,
  });

  const pasteApiKey = useCallback(async () => {
    const didPaste = await apiKeyController.pasteApiKey();
    if (didPaste) transcriptionController.clearTranscriptionOutput();
    transcriptionController.setAudioFilePasteStatus("");
  }, [
    apiKeyController.pasteApiKey,
    transcriptionController.clearTranscriptionOutput,
    transcriptionController.setAudioFilePasteStatus,
  ]);

  if (!voiceToText) return null;

  const resetVoiceToTextSettings = () => {
    updateFeatureSettings(defaultAppSettings.voiceToText);
    transcriptionController.resetTranscriptionUi();
    apiKeyController.resetApiKeyUi();
    focusAndSelect("v2t-shortcut-input");
  };

  return {
    voiceToText,
    handleChange,
    updateFeatureSettings,
    shortcutError,
    ...apiKeyController,
    ...transcriptionController,
    baseUrlError,
    modelError,
    languageError,
    setBaseUrlError,
    setModelError,
    setLanguageError,
    pasteApiKey,
    resetVoiceToTextSettings,
  };
};

export type VoiceToTextController = NonNullable<
  ReturnType<typeof useVoiceToTextController>
>;
