import { ArrowLeft, CalendarDays, Clock3, NotebookText } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Field,
  Switch,
  TextArea,
  TextInput,
} from "../../../design/components";
import {
  addDays,
  adjustEndTimeForStartChange,
  CalendarEventValidationError,
  createCalendarEvent,
  createDefaultEventDraft,
  draftToEventInput,
  eventToDraft,
  machineDateDistance,
  updateCalendarEvent,
} from "../events";
import type { CalendarEvent, CalendarEventDraft } from "../types";

interface CalendarEventEditorProps {
  event?: CalendarEvent;
  template?: CalendarEvent;
  initialDate?: string;
  /** Optional pre-filled fields applied when creating a new event
   *  (e.g. the "create event from note" cross-feature action). */
  initialTitle?: string;
  initialNotes?: string;
  showBackButton?: boolean;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  onSaved: (event: CalendarEvent) => void;
}

const validationFieldIds = {
  title: "calendar-event-title",
  date: "calendar-event-date",
  endDate: "calendar-event-end-date",
  startTime: "calendar-event-start-time",
  endTime: "calendar-event-end-time",
} as const;

const draftsAreEqual = (left: CalendarEventDraft, right: CalendarEventDraft) =>
  left.title === right.title &&
  left.date === right.date &&
  left.allDayDurationDays === right.allDayDurationDays &&
  left.startTime === right.startTime &&
  left.endTime === right.endTime &&
  left.allDay === right.allDay &&
  left.notes === right.notes;

export const CalendarEventEditor: React.FC<CalendarEventEditorProps> = ({
  event,
  template,
  initialDate,
  initialTitle,
  initialNotes,
  showBackButton = false,
  onCancel,
  onDirtyChange,
  onSavingChange,
  onSaved,
}) => {
  const initialDraft = useMemo(() => {
    const sourceEvent = event ?? template;
    if (sourceEvent) return eventToDraft(sourceEvent);
    const draft = createDefaultEventDraft(initialDate);
    if (initialTitle !== undefined) draft.title = initialTitle;
    if (initialNotes !== undefined) draft.notes = initialNotes;
    return draft;
  }, [event, initialDate, template, initialTitle, initialNotes]);
  const [draft, setDraft] = useState<CalendarEventDraft>(initialDraft);
  const [validationError, setValidationError] =
    useState<CalendarEventValidationError | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = !draftsAreEqual(draft, initialDraft);
  const allDayEndDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
    ? addDays(draft.date, Math.max(1, draft.allDayDurationDays) - 1)
    : "";

  useEffect(() => setDraft(initialDraft), [initialDraft]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    document.getElementById("calendar-event-title")?.focus();
    return () => onDirtyChange(false);
  }, [onDirtyChange]);

  const updateDraft = <K extends keyof CalendarEventDraft>(
    key: K,
    value: CalendarEventDraft[K],
  ) => {
    setValidationError(null);
    setSaveError("");
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateStartTime = (nextStartTime: string) => {
    setValidationError(null);
    setSaveError("");
    setDraft((current) => ({
      ...current,
      startTime: nextStartTime,
      endTime: adjustEndTimeForStartChange(
        current.startTime,
        current.endTime,
        nextStartTime,
      ),
    }));
  };

  const updateAllDayEndDate = (nextEndDate: string) => {
    if (!nextEndDate) {
      setValidationError(
        new CalendarEventValidationError(
          "endDate",
          "終了日を入力してください。",
        ),
      );
      return;
    }
    const durationDays = machineDateDistance(
      draft.date,
      addDays(nextEndDate, 1),
    );
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      setValidationError(
        new CalendarEventValidationError(
          "endDate",
          "終了日は開始日以降にしてください。",
        ),
      );
      return;
    }
    updateDraft("allDayDurationDays", durationDays);
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setValidationError(null);
    setSaveError("");
    setSaving(true);
    onSavingChange?.(true);
    try {
      const input = draftToEventInput(draft);
      const saved = event
        ? await updateCalendarEvent(event.id, input)
        : await createCalendarEvent(input);
      onDirtyChange(false);
      onSaved(saved);
    } catch (saveError) {
      if (saveError instanceof CalendarEventValidationError) {
        setValidationError(saveError);
        document.getElementById(validationFieldIds[saveError.field])?.focus();
      } else {
        console.error("Failed to save calendar event:", saveError);
        setSaveError("予定を保存できませんでした。もう一度お試しください。");
      }
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  };

  const handleKeyDown = (keyEvent: React.KeyboardEvent<HTMLFormElement>) => {
    if (
      keyEvent.key === "Enter" &&
      (keyEvent.ctrlKey || keyEvent.metaKey) &&
      !saving
    ) {
      keyEvent.preventDefault();
      keyEvent.currentTarget.requestSubmit();
    }
  };

  return (
    <form
      className="calendar-screen calendar-event-editor"
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <header className="calendar-screen__header">
        {showBackButton ? (
          <button
            type="button"
            className="calendar-icon-button"
            aria-label="戻る"
            onClick={onCancel}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : (
          <span className="calendar-screen__header-spacer" aria-hidden="true" />
        )}
        <h2>{event ? "予定を編集" : template ? "予定を複製" : "予定を追加"}</h2>
        <span className="calendar-screen__header-spacer" aria-hidden="true" />
      </header>

      <div className="calendar-event-editor__fields" data-window-drag-block>
        <div className="calendar-event-editor__title-field">
          <Field
            id="calendar-event-title"
            label="タイトル"
            error={
              validationError?.field === "title"
                ? validationError.message
                : undefined
            }
          >
            <TextInput
              id="calendar-event-title"
              value={draft.title}
              onChange={(changeEvent) =>
                updateDraft("title", changeEvent.target.value)
              }
              placeholder="予定のタイトル"
              autoComplete="off"
              invalid={validationError?.field === "title"}
            />
          </Field>
        </div>

        <section className="calendar-event-editor__section">
          <h3>
            <CalendarDays size={16} aria-hidden="true" />
            日時
          </h3>

          <div
            className={
              draft.allDay
                ? "calendar-event-editor__dates"
                : "calendar-event-editor__date"
            }
          >
            <Field
              id="calendar-event-date"
              label={draft.allDay ? "開始日" : "日付"}
              error={
                validationError?.field === "date"
                  ? validationError.message
                  : undefined
              }
            >
              <TextInput
                id="calendar-event-date"
                type="date"
                value={draft.date}
                onChange={(changeEvent) =>
                  updateDraft("date", changeEvent.target.value)
                }
                required
                invalid={validationError?.field === "date"}
              />
            </Field>

            {draft.allDay && (
              <Field
                id="calendar-event-end-date"
                label="終了日"
                error={
                  validationError?.field === "endDate"
                    ? validationError.message
                    : undefined
                }
              >
                <TextInput
                  id="calendar-event-end-date"
                  type="date"
                  min={draft.date}
                  value={allDayEndDate}
                  onChange={(changeEvent) =>
                    updateAllDayEndDate(changeEvent.target.value)
                  }
                  required
                  invalid={validationError?.field === "endDate"}
                />
              </Field>
            )}
          </div>

          <div className="calendar-event-editor__all-day">
            <span>
              <Clock3 size={15} aria-hidden="true" />
              終日の予定
            </span>
            <Switch
              id="calendar-event-all-day"
              checked={draft.allDay}
              onChange={(changeEvent) =>
                updateDraft("allDay", changeEvent.target.checked)
              }
              aria-label="終日の予定"
            />
          </div>

          {!draft.allDay && (
            <div className="calendar-event-editor__times">
              <Field
                id="calendar-event-start-time"
                label="開始"
                error={
                  validationError?.field === "startTime"
                    ? validationError.message
                    : undefined
                }
              >
                <TextInput
                  id="calendar-event-start-time"
                  type="time"
                  value={draft.startTime}
                  onChange={(changeEvent) =>
                    updateStartTime(changeEvent.target.value)
                  }
                  required
                  invalid={validationError?.field === "startTime"}
                />
              </Field>
              <Field
                id="calendar-event-end-time"
                label="終了"
                error={
                  validationError?.field === "endTime"
                    ? validationError.message
                    : undefined
                }
              >
                <TextInput
                  id="calendar-event-end-time"
                  type="time"
                  value={draft.endTime}
                  onChange={(changeEvent) =>
                    updateDraft("endTime", changeEvent.target.value)
                  }
                  required
                  invalid={validationError?.field === "endTime"}
                />
              </Field>
            </div>
          )}
        </section>

        <section className="calendar-event-editor__section">
          <h3>
            <NotebookText size={16} aria-hidden="true" />
            詳細
          </h3>
          <Field id="calendar-event-notes" label="メモ（任意）">
            <TextArea
              id="calendar-event-notes"
              value={draft.notes}
              onChange={(changeEvent) =>
                updateDraft("notes", changeEvent.target.value)
              }
              rows={3}
              placeholder="場所や補足など"
            />
          </Field>
        </section>
        {saveError && (
          <p className="calendar-event-editor__error" role="alert">
            {saveError}
          </p>
        )}
      </div>

      <footer className="calendar-screen__actions">
        <span className="calendar-event-editor__save-state" aria-live="polite">
          {saving ? "変更を保存しています…" : dirty ? "未保存の変更" : ""}
        </span>
        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={onCancel}
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          disabled={saving}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          title="保存（Ctrl + Enter）"
        >
          {saving ? "保存中…" : "保存"}
        </Button>
      </footer>
    </form>
  );
};
