"use client";

import { useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { DropResult } from "@hello-pangea/dnd";

const DragDropContext = dynamic(
  () => import("@hello-pangea/dnd").then((mod) => mod.DragDropContext),
  { ssr: false },
);
const Droppable = dynamic(
  () => import("@hello-pangea/dnd").then((mod) => mod.Droppable),
  { ssr: false },
);
const Draggable = dynamic(
  () => import("@hello-pangea/dnd").then((mod) => mod.Draggable),
  { ssr: false },
);

export type LocalPhoto = {
  id: number;
  filePath: string;
  caption: string | null;
  orderIndex: number;
  _file: File;
};

const MAX_PHOTOS = 20;

export function PhotoUploader({
  photos,
  thumbnailIdx,
  dragging,
  onPhotosChange,
  onThumbnailChange,
  onDraggingChange,
}: {
  photos: LocalPhoto[];
  thumbnailIdx: number;
  dragging: boolean;
  onPhotosChange: (updater: (prev: LocalPhoto[]) => LocalPhoto[]) => void;
  onThumbnailChange: (updater: (prev: number) => number) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];

      onPhotosChange((prev) => {
        const remaining = MAX_PHOTOS - prev.length;
        const toAdd = fileArr.filter((f) => allowed.includes(f.type)).slice(0, remaining);
        return [
          ...prev,
          ...toAdd.map((file, i) => ({
            id: -(prev.length + i + 1),
            filePath: URL.createObjectURL(file),
            caption: null,
            orderIndex: prev.length + i + 1,
            _file: file,
          })),
        ];
      });
    },
    [onPhotosChange],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDraggingChange(true);
  }, [onDraggingChange]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDraggingChange(false);
  }, [onDraggingChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDraggingChange(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles, onDraggingChange],
  );

  const updateCaption = (i: number, caption: string) =>
    onPhotosChange((prev) => prev.map((p, idx) => (idx === i ? { ...p, caption: caption || null } : p)));

  const removePhoto = (i: number) => {
    onPhotosChange((prev) => {
      const removed = prev[i];
      if (removed.filePath.startsWith("blob:")) URL.revokeObjectURL(removed.filePath);
      return prev.filter((_, idx) => idx !== i);
    });
    onThumbnailChange((prev) => {
      if (i < prev) return prev - 1;
      if (i === prev) return 0;
      return prev;
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    onPhotosChange((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((p, i) => ({ ...p, orderIndex: i + 1 }));
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">사진 *</CardTitle>
          <Badge variant="secondary">{photos.length}/{MAX_PHOTOS}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {photos.length < MAX_PHOTOS && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              dragging
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] hover:border-[var(--border-hover)]",
            )}
          >
            <p className="text-sm text-[var(--text-muted)]">
              {dragging ? "여기에 놓으세요!" : "클릭 또는 드래그앤드롭으로 사진 추가"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">JPEG, PNG, WebP, HEIC / 최대 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {photos.length > 0 && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="photos" direction="horizontal">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="grid grid-cols-2 md:grid-cols-3 gap-3"
                >
                  {photos.map((photo, i) => (
                    <Draggable key={`photo-${i}`} draggableId={`photo-${i}`} index={i}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={cn("relative group", snapshot.isDragging && "opacity-80 shadow-lg z-10")}
                        >
                          <div
                            {...dragProvided.dragHandleProps}
                            className="absolute top-1 left-1 z-10 flex items-center gap-1"
                          >
                            <span className="bg-black/60 text-white text-[10px] rounded px-1.5 py-0.5 cursor-grab active:cursor-grabbing flex items-center gap-0.5">
                              ⠿ {i + 1}
                            </span>
                          </div>
                          <img
                            src={photo.filePath}
                            alt={photo.caption ?? `사진 ${i + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => onThumbnailChange(() => i)}
                            className={cn(
                              "absolute bottom-10 left-1 w-6 h-6 rounded-full text-xs flex items-center justify-center transition-all",
                              thumbnailIdx === i
                                ? "bg-yellow-400 text-black"
                                : "bg-black/40 text-white/60 opacity-0 group-hover:opacity-100",
                            )}
                            title="대표 사진 지정"
                          >
                            ★
                          </button>
                          <button
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            X
                          </button>
                          <Input
                            value={photo.caption ?? ""}
                            onChange={(e) => updateCaption(i, e.target.value)}
                            placeholder="사진 설명..."
                            className="mt-1 text-xs h-7"
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </CardContent>
    </Card>
  );
}
