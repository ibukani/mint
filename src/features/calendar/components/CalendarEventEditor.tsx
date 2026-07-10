import { ArrowLeft } from "lucide-react";
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
  createCalendarEvent,
  createDefaultEventDraft,
  draftToEventInput,
  eventToDraft,
  updateCalendarEvent,
} from "../events";
import type { CalendarEvent, CalendarEventDraft } from "../types";

interface CalendarEventEditorProps {
  event?: CalendarEvent;
  initialDate?: string;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (event: CalendarEvent) => void;
}

export const CalendarEventEditor: React.FC<CalendarEventEditorProps> = ({
  event,
  initialDate,
  onCancel,
  onDirtyChange,
  onSaved,
}) => {
  const initialDraft = useMemo(
    () => (event ? eventToDraft(event) : createDefaultEventDraft(initialDate)),
    [event, initialDate],
  );
  const [draft, setDraft] = useState<CalendarEventDraft>(initialDraft);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  useEffect(() => setDraft(initialDraft), [initialDraft]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    document.getElementById("calendar-event-title")?.focus();
    return () => onDirtyChange(false);
  }, [onDirtyChange]);

  const updateDraft = <K extends keyof CalendarEventDraft>(
    key: K,
    value: CalendarEventDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setError("");
    setSaving(true);
    try {
      const input = draftToEventInput(draft);
      const saved = event
        ? await updateCalendarEvent(event.id, input)
        : await createCalendarEvent(input);
      onDirtyChange(false);
      onSaved(saved);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "予定を保存できませんでした",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="calendar-screen calendar-event-editor"
      onSubmit={handleSubmit}
    >
      <header className="calendar-screen__header">
        <button
          type="button"
          className="calendar-icon-button"
          aria-label="戻る"
          onClick={onCancel}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h2>{event ? "予定を編集" : "予定を追加"}</h2>
        <span className="calendar-screen__header-spacer" aria-hidden="true" />
      </header>

      <div className="calendar-event-editor__fields">
        <Field id="calendar-event-title" label="タイトル" error={error}>
          <TextInput
            id="calendar-event-title"
            value={draft.title}
            onChange={(changeEvent) =>
              updateDraft("title", changeEvent.target.value)
            }
            placeholder="予定のタイトル"
            autoComplete="off"
          />
        </Field>

        <Field id="calendar-event-date" label="日付">
          <TextInput
            id="calendar-event-date"
            type="date"
            value={draft.date}
            onChange={(changeEvent) =>
              updateDraft("date", changeEvent.target.value)
            }
            required
          />
        </Field>

        <div className="calendar-event-editor__all-day">
          <span>終日</span>
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
            <Field id="calendar-event-start-time" label="開始">
              <TextInput
                id="calendar-event-start-time"
                type="time"
                value={draft.startTime}
                onChange={(changeEvent) =>
                  updateDraft("startTime", changeEvent.target.value)
                }
                required
              />
            </Field>
            <Field id="calendar-event-end-time" label="終了">
              <TextInput
                id="calendar-event-end-time"
                type="time"
                value={draft.endTime}
                onChange={(changeEvent) =>
                  updateDraft("endTime", changeEvent.target.value)
                }
                required
              />
            </Field>
          </div>
        )}

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
      </div>

      <footer className="calendar-screen__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
      </footer>
    </form>
  );
};
