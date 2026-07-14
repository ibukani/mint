import {
  AudioLines,
  Check,
  ClipboardCopy,
  ClipboardPaste,
  FileAudio,
  FolderOpen,
  LoaderCircle,
  Mic,
  RefreshCw,
  Square,
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
    audioFilePasteTone,
    isDropTarget,
    workbenchRef,
    transcriptionText,
    transcriptionError,
    copyStatus,
    copyTone,
    transcribing,
    recording,
    recordingSeconds,
    canTranscribe,
    canRecord,
    canRetryTranscription,
    transcribeHelpText,
    setupSteps,
    transcribeAudioFile,
    retryTranscription,
    startRecording,
    stopRecording,
    discardRecording,
    copyTranscriptionText,
    clearTranscriptionText,
    updateAudioFilePath,
    clearAudioFilePath,
    pasteAudioFilePath,
    selectAudioFile,
    handleAudioFilePathKeyDown,
    handleWorkbenchKeyDown,
    normalizeAudioFilePath,
  } = controller;

  const formattedRecordingDuration = `${String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:${String(recordingSeconds % 60).padStart(2, "0")}`;

  return (
    <section
      ref={workbenchRef}
      className={`v2t-workbench ${isDropTarget ? "is-drop-target" : ""}`}
      aria-labelledby="v2t-workbench-title"
      aria-busy={transcribing}
      onKeyDown={handleWorkbenchKeyDown}
    >
      <div className="v2t-workbench__header">
        <div>
          <span className="v2t-workbench__kicker">ワークベンチ</span>
          <h3 id="v2t-workbench-title">文字起こし</h3>
        </div>
        <div className="v2t-workbench__header-actions">
          {recording && (
            <span className="v2t-recording-status" role="status">
              録音中 {formattedRecordingDuration}
            </span>
          )}
          <span
            className={`v2t-readiness ${canTranscribe ? "is-ready" : ""}`}
            aria-live="polite"
            aria-atomic="true"
          >
            {canTranscribe ? "実行可能" : "準備中"}
          </span>
          <Button
            variant={recording ? "danger" : "ghost"}
            className="v2t-record-button"
            disabled={!recording && !canRecord}
            onClick={() =>
              recording ? stopRecording() : void startRecording()
            }
            aria-label={
              recording ? "録音を停止して文字起こし" : "マイク録音を開始"
            }
            title={
              recording
                ? "録音を停止して文字起こし"
                : "マイクから録音して文字起こし"
            }
          >
            {recording ? (
              <>
                <Square size={14} aria-hidden="true" /> 録音を停止
              </>
            ) : (
              <>
                <Mic size={15} aria-hidden="true" /> マイク録音
              </>
            )}
          </Button>
          {recording && (
            <Button
              variant="ghost"
              className="v2t-discard-recording-button"
              onClick={discardRecording}
              aria-label="録音を破棄"
              title="録音を送信せずに破棄"
            >
              <Trash2 size={14} aria-hidden="true" />
              破棄
            </Button>
          )}
        </div>
      </div>
      {isDropTarget && (
        <div className="v2t-workbench__drop-overlay" role="status">
          <AudioLines size={22} aria-hidden="true" />
          <strong>音声ファイルをここにドロップ</strong>
          <span>対応形式: WAV / MP3 / M4A / FLAC など</span>
        </div>
      )}
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
          helpText="ファイルを選ぶ、パスを貼り付ける、ワークベンチへドロップする、またはマイクから録音できます。Enter でも文字起こしを開始できます。"
        >
          <div className="v2t-control-with-status">
            <FieldRow className="v2t-file-row">
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
                aria-label="音声ファイルを選択"
                title="ファイルを選択"
                onClick={() => void selectAudioFile()}
              >
                <FolderOpen size={16} aria-hidden="true" />
              </Button>
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
                disabled={!audioFilePath}
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </FieldRow>
            {audioFilePasteStatus && (
              <div className="v2t-control-status">
                <StatusToast
                  message={audioFilePasteStatus}
                  tone={audioFilePasteTone}
                />
              </div>
            )}
          </div>
        </Field>

        <Field id="v2t-transcribe-button" helpText={transcribeHelpText}>
          <Button
            id="v2t-transcribe-button"
            className="v2t-transcribe-button"
            onClick={() => void transcribeAudioFile()}
            disabled={!canTranscribe}
            aria-keyshortcuts="Control+Enter Meta+Enter"
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
          <div className="v2t-transcription-error">
            <ErrorMessage autoFocus>{transcriptionError}</ErrorMessage>
            {canRetryTranscription && (
              <Button
                variant="ghost"
                className="v2t-retry-button"
                onClick={() => void retryTranscription()}
              >
                <RefreshCw size={15} aria-hidden="true" />
                再試行
              </Button>
            )}
          </div>
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
              {copyStatus && (
                <StatusToast message={copyStatus} tone={copyTone} />
              )}
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
