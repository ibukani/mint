import { useEffect, useMemo, useRef, useState } from "react";
import { loadFileShelfPreview } from "../api";
import type { FileShelfItem } from "../types";

interface FileShelfPreviewState {
  allItems: FileShelfItem[];
}

export const useFileShelfPreview = ({ allItems }: FileShelfPreviewState) => {
  const [previewItemId, setPreviewItemId] = useState("");
  const [previewPinned, setPreviewPinned] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewCloseRef = useRef<HTMLButtonElement | null>(null);
  const previewRevision = useRef(0);

  const previewItem = useMemo(
    () => allItems.find((item) => item.id === previewItemId) ?? null,
    [allItems, previewItemId],
  );

  useEffect(() => {
    if (previewItemId && !previewItem) {
      setPreviewItemId("");
      setPreviewPinned(false);
    }
  }, [previewItem, previewItemId]);

  useEffect(() => {
    const revision = ++previewRevision.current;
    setPreviewDataUrl(null);
    setPreviewError("");
    if (previewItem?.kind !== "image" || previewItem.availability !== "ready") {
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    void loadFileShelfPreview(previewItem.id)
      .then((preview) => {
        if (revision === previewRevision.current) {
          setPreviewDataUrl(preview.dataUrl);
        }
      })
      .catch((reason: unknown) => {
        if (revision === previewRevision.current) {
          setPreviewError(
            reason instanceof Error ? reason.message : String(reason),
          );
        }
      })
      .finally(() => {
        if (revision === previewRevision.current) setPreviewLoading(false);
      });
  }, [previewItem]);

  useEffect(() => {
    if (!previewItem) return;
    previewCloseRef.current?.focus({ preventScroll: true });
  }, [previewItem]);

  const closePreview = () => {
    setPreviewItemId("");
    setPreviewPinned(false);
  };

  const togglePreview = (item: FileShelfItem) => {
    if (previewItemId === item.id) {
      closePreview();
      return;
    }
    setPreviewItemId(item.id);
    setPreviewPinned(false);
  };

  return {
    closePreview,
    previewCloseRef,
    previewDataUrl,
    previewError,
    previewItem,
    previewItemId,
    previewLoading,
    previewPinned,
    setPreviewPinned,
    togglePreview,
  };
};
