import { Clipboard, File, FileImage, Folder, Link } from "lucide-react";
import type { FileShelfItemKind } from "../types";

export const FileShelfItemIcon = ({
  kind,
  className,
}: {
  kind: FileShelfItemKind;
  className?: string;
}) => {
  if (kind === "folder") {
    return <Folder className={className} size={18} aria-hidden="true" />;
  }
  if (kind === "image") {
    return <FileImage className={className} size={18} aria-hidden="true" />;
  }
  if (kind === "url") {
    return <Link className={className} size={18} aria-hidden="true" />;
  }
  if (kind === "text") {
    return <Clipboard className={className} size={18} aria-hidden="true" />;
  }
  return <File className={className} size={18} aria-hidden="true" />;
};
