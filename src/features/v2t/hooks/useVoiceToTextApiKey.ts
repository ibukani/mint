import { useCallback, useEffect, useState } from "react";
import { loadVoiceToTextApiKey, saveVoiceToTextApiKey } from "../api";
import { focusAndSelect } from "../focus";
import { useTransientStatus } from "./useTransientStatus";

const STATUS_VISIBLE_MS = 2000;
const EMPTY_PASTE_STATUS = "貼り付ける内容がありません";
const CLIPBOARD_READ_ERROR_STATUS =
  "クリップボードから貼り付けられませんでした";

export const useVoiceToTextApiKey = () => {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [apiKeySaveError, setApiKeySaveError] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaveStatus, setApiKeySaveStatus, apiKeySaveTone] =
    useTransientStatus(STATUS_VISIBLE_MS);
  const [apiKeyPasteStatus, setApiKeyPasteStatus, apiKeyPasteTone] =
    useTransientStatus(STATUS_VISIBLE_MS);

  useEffect(() => {
    async function loadKey() {
      try {
        const key = await loadVoiceToTextApiKey();
        setApiKey(typeof key === "string" ? key : "");
      } catch (error) {
        console.error("Failed to load API key:", error);
      } finally {
        setApiKeyLoaded(true);
      }
    }
    void loadKey();
  }, []);

  useEffect(() => {
    if (showApiKey && apiKeyLoaded) focusAndSelect("v2t-api-key-input");
  }, [apiKeyLoaded, showApiKey]);

  useEffect(() => {
    if (apiKeyPasteStatus === "API キーを貼り付けました") {
      focusAndSelect("v2t-api-key-input");
    }
  }, [apiKeyPasteStatus]);

  const saveApiKey = useCallback(async () => {
    setApiKeyPasteStatus("");
    setApiKeySaveStatus("");
    try {
      await saveVoiceToTextApiKey(apiKey);
      setApiKeySaveError("");
      setApiKeySaveStatus("APIキーを保存しました");
    } catch (error) {
      console.error("Failed to save API key:", error);
      setApiKeySaveError(
        "APIキーの保存に失敗しました。もう一度お試しください。",
      );
      setApiKeySaveStatus("");
    }
  }, [apiKey, setApiKeyPasteStatus, setApiKeySaveStatus]);

  const pasteApiKey = useCallback(async () => {
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (!value) {
        setApiKeyPasteStatus(EMPTY_PASTE_STATUS, "warning");
        return;
      }
      setApiKey(value);
      setApiKeySaveStatus("");
      setApiKeyPasteStatus("API キーを貼り付けました");
    } catch (error) {
      console.error("Failed to paste API key:", error);
      setApiKeyPasteStatus(CLIPBOARD_READ_ERROR_STATUS, "error");
    } finally {
      focusAndSelect("v2t-api-key-input");
    }
  }, [setApiKeyPasteStatus, setApiKeySaveStatus]);

  const resetApiKeyUi = useCallback(() => {
    setApiKeySaveStatus("");
    setApiKeyPasteStatus("");
    setShowApiKey(false);
  }, [setApiKeyPasteStatus, setApiKeySaveStatus]);

  return {
    apiKey,
    apiKeyLoaded,
    apiKeySaveError,
    apiKeySaveStatus,
    apiKeySaveTone,
    apiKeyPasteStatus,
    apiKeyPasteTone,
    showApiKey,
    setApiKey,
    setApiKeySaveError,
    setApiKeySaveStatus,
    setApiKeyPasteStatus,
    setShowApiKey,
    saveApiKey,
    pasteApiKey,
    resetApiKeyUi,
  };
};
