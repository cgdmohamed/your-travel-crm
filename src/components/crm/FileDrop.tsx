import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export type PickedFile = { name: string; mime: string; size: number; dataUrl: string };

const MAX = 5 * 1024 * 1024;

export async function readFile(file: File): Promise<PickedFile | null> {
  if (file.size > MAX) {
    toast.error(`الملف ${file.name} أكبر من 5 ميجابايت`);
    return null;
  }
  const dataUrl = await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
  return { name: file.name, mime: file.type || "application/octet-stream", size: file.size, dataUrl };
}

export function FileDrop({
  onFiles,
  label = "اسحب ملف التذكرة هنا (PDF أو صورة) أو اضغط للاختيار",
  compact,
}: {
  onFiles: (files: PickedFile[]) => void;
  label?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const out: PickedFile[] = [];
    for (const f of Array.from(list)) {
      const picked = await readFile(f);
      if (picked) out.push(picked);
    }
    if (out.length) onFiles(out);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handle(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center transition-colors ${
        compact ? "p-3" : "p-6"
      } ${over ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:border-primary/60"}`}
    >
      <Upload className="size-4 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export const fileSize = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} م.ب` : `${Math.max(1, Math.round(n / 1024))} ك.ب`;
