import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/shared/ui/button";
import { SendIcon, ImageIcon, XIcon } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  onSendWithImage: (content: string, image: File) => void;
  pendingImage: File | null;
  onImageSelect: (image: File | null) => void;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onSendWithImage,
  pendingImage,
  onImageSelect,
  disabled,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoize pendingImage's Object URL (prevent duplicate creation)
  const imagePreviewUrl = useMemo(() => {
    if (!pendingImage) return null;
    return URL.createObjectURL(pendingImage);
  }, [pendingImage]);

  // cleanup on unmount or when image changes
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleSubmit = () => {
    if (disabled) return;

    if (pendingImage) {
      // Send with image if image is attached
      const message = value.trim() || "Please analyze this image";
      onSendWithImage(message, pendingImage);
      setValue("");
    } else {
      // Send text only
      const trimmed = value.trim();
      if (!trimmed) return;
      onSend(trimmed);
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate image type
      if (!file.type.startsWith("image/")) {
        alert("Only image files can be uploaded.");
        return;
      }
      // Size limit (20MB)
      if (file.size > 20 * 1024 * 1024) {
        alert("Image size must be 20MB or less.");
        return;
      }
      onImageSelect(file);
    }
    // Allow reselecting the same file
    e.target.value = "";
  };

  const handleRemoveImage = () => {
    onImageSelect(null);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const canSubmit = pendingImage || value.trim();

  return (
    <div className="border-t p-4 pb-9">
      {/* Image preview */}
      {imagePreviewUrl && (
        <div className="mb-2 relative inline-block">
          <img
            src={imagePreviewUrl}
            alt="Preview"
            className="h-20 rounded border object-cover"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/90"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {/* Image select button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Attach image"
        >
          <ImageIcon className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingImage ? "Ask about this image..." : "Type a message..."
          }
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
        />

        <Button
          onClick={handleSubmit}
          disabled={disabled || !canSubmit}
          size="icon"
          title="Send"
        >
          <SendIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
