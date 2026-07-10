import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "../../../design/components";
import {
  deleteCalendarEvent,
  formatEventDate,
  formatEventTime,
} from "../events";
import type { CalendarEvent } from "../types";

interface CalendarEventDetailProps {
  event: CalendarEvent;
  onBack: () => void;
  onDeleted: () => void;
  onEdit: () => void;
}

export const CalendarEventDetail: React.FC<CalendarEventDetailProps> = ({
  event,
  onBack,
  onDeleted,
  onEdit,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!window.confirm(`「${event.title}」を削除しますか？`)) return;
    setDeleting(true);
    setError("");
    try {
      await deleteCalendarEvent(event.id);
      onDeleted();
    } catch (deleteError) {
      console.error("Failed to delete calendar event:", deleteError);
      setError("予定を削除できませんでした");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="calendar-screen calendar-event-detail">
      <header className="calendar-screen__header">
        <button
          type="button"
          className="calendar-icon-button"
          aria-label="戻る"
          onClick={onBack}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h2>予定の詳細</h2>
        <span className="calendar-screen__header-spacer" aria-hidden="true" />
      </header>

      <div className="calendar-event-detail__body">
        <p className="calendar-event-detail__date">{formatEventDate(event)}</p>
        <h3>{event.title}</h3>
        <p className="calendar-event-detail__time">{formatEventTime(event)}</p>
        {event.notes && (
          <p className="calendar-event-detail__notes">{event.notes}</p>
        )}
        {error && (
          <p className="calendar-screen__status is-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <footer className="calendar-screen__actions">
        <Button
          type="button"
          variant="ghost"
          className="calendar-event-detail__delete"
          disabled={deleting}
          onClick={handleDelete}
        >
          <Trash2 size={16} aria-hidden="true" />
          {deleting ? "削除中…" : "削除"}
        </Button>
        <Button type="button" onClick={onEdit}>
          <Pencil size={16} aria-hidden="true" />
          編集
        </Button>
      </footer>
    </article>
  );
};
