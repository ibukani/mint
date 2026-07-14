import { ArrowLeft, CopyPlus, Pencil, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button, ConfirmDialog } from "../../../design/components";
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
  onDuplicate: () => void;
  onEdit: () => void;
}

export const CalendarEventDetail: React.FC<CalendarEventDetailProps> = ({
  event,
  onBack,
  onDeleted,
  onDuplicate,
  onEdit,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const readOnly =
    event.source.kind === "google" &&
    !["writer", "owner"].includes(event.source.accessRole);

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteCalendarEvent(event.id);
      setDeleteDialogOpen(false);
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

      <div className="calendar-event-detail__body" data-window-drag-block>
        <p className="calendar-event-detail__date">{formatEventDate(event)}</p>
        <h3>{event.title}</h3>
        <p className="calendar-event-detail__time">{formatEventTime(event)}</p>
        {event.notes && (
          <p className="calendar-event-detail__notes">{event.notes}</p>
        )}
        {readOnly && <p>この予定表は読み取り専用です。</p>}
      </div>

      <footer className="calendar-screen__actions">
        <Button
          type="button"
          variant="ghost"
          className="calendar-event-detail__delete"
          disabled={deleting || readOnly}
          onClick={() => {
            setError("");
            setDeleteDialogOpen(true);
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          {deleting ? "削除中…" : "削除"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-keyshortcuts="D"
          title="複製して編集（D）"
          onClick={onDuplicate}
        >
          <CopyPlus size={16} aria-hidden="true" />
          複製
        </Button>
        <Button
          type="button"
          aria-keyshortcuts="E"
          title="編集（E）"
          disabled={readOnly}
          onClick={onEdit}
        >
          <Pencil size={16} aria-hidden="true" />
          編集
        </Button>
      </footer>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="この予定を削除しますか？"
        description={
          <>
            「{event.title}」を削除します。
            {event.source.kind === "google"
              ? "Google Calendarにも削除が反映されます。"
              : "この操作は取り消せません。"}
          </>
        }
        confirmLabel="削除する"
        busy={deleting}
        busyLabel="削除しています…"
        error={error}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setError("");
        }}
        onConfirm={() => void handleDelete()}
      />
    </article>
  );
};
