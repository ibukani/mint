import {
  AudioLines,
  Check,
  ClipboardCopy,
  ClipboardPaste,
  FileAudio,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import type React from "react";
import {
  Button,
  ErrorMessage,
  Field,
  FieldRow,
  TextArea,
  TextInput,
} from "../../../design/components";
import type { VoiceToTextController } from "../hooks/useVoiceToTextController";
import { StatusToast } from "./StatusToast";

export const TranscriptionWorkbench: React.FC<{
  controller: VoiceToTextController;
}> = ({ controller }) => {
  const {
    audioFilePath,
    audioFilePasteStatus,
    transcriptionText,
    transcriptionError,
    copyStatus,
    transcribing,
    canTranscribe,
    transcribeHelpText,
    setupSteps,
    transcribeAudioFile,
    copyTranscriptionText,
    clearTranscriptionText,
    updateAudioFilePath,
    clearAudioFilePath,
    pasteAudioFilePath,
    handleAudioFilePathKeyDown,
    normalizeAudioFilePath,
  } = controller;

  return (
    <section
      className="v2t-workbench"
      aria-labelledby="v2t-workbench-title"
      aria-busy={transcribing}
    >
      <div className="v2t-workbench__header">
        <div>
          <span className="v2t-workbench__kicker">ワークベンチ</span>
          <h3 id="v2t-workbench-title">文字起こし</h3>
        </div>
        <span
          className={`v2t-readiness ${canTranscribe ? "is-ready" : ""}`}
          aria-live="polite"
        >
          {canTranscribe ? "実行可能" : "準備中"}
        </span>
      </div>
      <div className="v2t-workbench__body">
        <ol className="v2t-setup-steps" aria-label="文字起こしの準備状況">
          {setupSteps.map((step, index) => {
            const isCurrent =
              !step.complete &&
              (index === 0 || setupSteps[index - 1]?.complete === true);
            return (
              <li
                key={step.label}
                className={`v2t-setup-step ${step.complete ? "is-complete" : ""} ${isCurrent ? "is-current" : ""}`}
              >
                <span className="v2t-setup-step__marker" aria-hidden="true">
                  {step.complete ? <Check size={14} /> : index + 1}
                </span>
                <span className="v2t-setup-step__copy">
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <Field
          id="v2t-audio-file-input"
          label="音声ファイルパス"
          helpText="wav、mp3、m4a など、利用する音声認識APIが対応する音声ファイルを指定します。Enter でも文字起こしを開始できます。"
        >
          <FieldRow>
            <TextInput
              id="v2t-audio-file-input"
              className="v2t-row-input"
              type="text"
              value={audioFilePath}
              onChange={(event) => updateAudioFilePath(event.target.value)}
              onBlur={(event) => normalizeAudioFilePath(event.target.value)}
              onKeyDown={handleAudioFilePathKeyDown}
              aria-keyshortcuts="Enter"
              placeholder="例: /Users/me/audio.wav"
            />
            <Button
              variant="ghost"
              className="v2t-icon-button"
              aria-label="音声ファイルパスを貼り付け"
              title="貼り付け"
              onClick={() => void pasteAudioFilePath()}
            >
              <ClipboardPaste size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              className="v2t-icon-button"
              aria-label="クリア"
              title="クリア"
              onClick={clearAudioFilePath}
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
            {audioFilePasteStatus && (
              <StatusToast message={audioFilePasteStatus} />
            )}
          </FieldRow>
        </Field>

        <Field id="v2t-transcribe-button" helpText={transcribeHelpText}>
          <Button
            className="v2t-transcribe-button"
            onClick={() => void transcribeAudioFile()}
            disabled={!canTranscribe}
          >
            {transcribing ? (
              <LoaderCircle
                className="spinner-icon"
                size={16}
                aria-hidden="true"
              />
            ) : (
              <AudioLines size={16} aria-hidden="true" />
            )}
            {transcribing ? "文字起こし中..." : "文字起こしを実行"}
          </Button>
        </Field>

        {transcriptionError && (
          <ErrorMessage autoFocus>{transcriptionError}</ErrorMessage>
        )}

        {transcriptionText ? (
          <Field id="v2t-transcription-result" label="文字起こし結果">
            <div className="transcription-result-actions">
              <Button
                id="v2t-copy-result-button"
                variant="ghost"
                onClick={() => void copyTranscriptionText()}
              >
                <ClipboardCopy size={15} aria-hidden="true" />
                結果をコピー
              </Button>
              <Button variant="ghost" onClick={clearTranscriptionText}>
                <Trash2 size={15} aria-hidden="true" />
                結果をクリア
              </Button>
              {copyStatus && <StatusToast message={copyStatus} />}
            </div>
            <TextArea
              id="v2t-transcription-result"
              value={transcriptionText}
              readOnly
              rows={6}
            />
          </Field>
        ) : (
          !transcriptionError && (
            <div className="v2t-empty-state">
              <FileAudio size={28} aria-hidden="true" />
              <span>結果はここに表示されます</span>
            </div>
          )
        )}
      </div>
    </section>
  );
};
