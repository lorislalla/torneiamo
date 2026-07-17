import type { ButtonHTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-lime-300/80 disabled:pointer-events-none disabled:opacity-45",
        variant === "primary" &&
          "bg-lime-300 text-emerald-950 shadow-[0_10px_35px_rgba(190,255,102,.14)] hover:-translate-y-0.5 hover:bg-lime-200",
        variant === "secondary" &&
          "border border-white/10 bg-white/[.055] text-white hover:border-white/20 hover:bg-white/[.09]",
        variant === "ghost" && "text-white/65 hover:bg-white/[.06] hover:text-white",
        variant === "danger" &&
          "border border-red-400/20 bg-red-400/10 text-red-200 hover:bg-red-400/15",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "icon" && "size-10",
        className,
      )}
      {...props}
    />
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-white/10 bg-[#0c1813] shadow-2xl sm:max-w-2xl sm:rounded-[1.75rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/8 bg-[#0c1813]/95 px-5 py-5 backdrop-blur sm:px-7">
          <div>
            <h2 id="modal-title" className="text-xl font-semibold tracking-tight text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-white/50">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Chiudi">
            <X className="size-5" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PlayerMark({
  name,
  accent,
  size = "md",
}: {
  name: string;
  accent: string;
  size?: "sm" | "md";
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-mono font-semibold text-emerald-950",
        size === "sm" ? "size-7 text-[10px]" : "size-9 text-xs",
      )}
      style={{ backgroundColor: accent }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-white/45">
      {children}
    </span>
  );
}

