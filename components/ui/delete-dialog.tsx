"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ─── Component ────────────────────────────────────────────────────────────────

export interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Runs when the user confirms. May be async — the dialog shows a spinner
   * while it resolves and auto-closes on success. If it throws, the dialog
   * stays open so the caller can surface an error (e.g. a toast).
   */
  onConfirm: () => void | Promise<void>;
  title?: string;
  /** Free-form description. Overrides the auto-generated `itemName` sentence. */
  description?: React.ReactNode;
  /** Bolded name of the thing being deleted, used in the default description. */
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** External loading control. When omitted, the dialog tracks it internally. */
  loading?: boolean;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description,
  itemName,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading,
}: DeleteConfirmationDialogProps) {
  const [pending, setPending] = useState(false);
  const isLoading = loading ?? pending;

  const handleConfirm = useCallback(async () => {
    try {
      setPending(true);
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Keep the dialog open; the caller is responsible for the error message.
    } finally {
      setPending(false);
    }
  }, [onConfirm, onOpenChange]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Block dismissal (overlay click / Esc) while the action is running.
        if (isLoading) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-destructive/25 bg-card text-destructive">
              <TriangleAlert className="size-5" />
            </div>
            <div className="space-y-1">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>
                {description ?? (
                  <>
                    This will permanently delete{" "}
                    {itemName ? (
                      <span className="font-medium text-foreground">
                        {itemName}
                      </span>
                    ) : (
                      "this item"
                    )}
                    . This action cannot be undone.
                  </>
                )}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            // Prevent Radix's default auto-close so async errors keep it open.
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isLoading}
            className={cn(
              "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              "focus-visible:ring-destructive",
            )}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isLoading ? "Deleting..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Companion hook ───────────────────────────────────────────────────────────

/**
 * Ergonomic state for confirm-before-delete flows. Stores the target item so
 * you can show its name and run the deletion against it.
 *
 * @example
 * const del = useDeleteConfirmation<Campaign>();
 *
 * <Button onClick={() => del.confirm(campaign)}>Delete</Button>
 *
 * <DeleteConfirmationDialog
 *   open={del.open}
 *   onOpenChange={del.onOpenChange}
 *   itemName={del.target?.name}
 *   onConfirm={async () => { await api.delete(del.target!.id); }}
 * />
 */
export function useDeleteConfirmation<T = unknown>() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<T | null>(null);

  const confirm = useCallback((item: T) => {
    setTarget(item);
    setOpen(true);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setTarget(null);
  }, []);

  return { open, target, confirm, onOpenChange };
}
