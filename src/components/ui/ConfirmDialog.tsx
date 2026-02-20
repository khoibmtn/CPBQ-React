"use client";

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
    open: boolean;
    title?: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open,
    title = "Xác nhận",
    message,
    confirmLabel = "Xác nhận",
    cancelLabel = "Hủy",
    variant = "danger",
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onCancel]);

    // Focus trap
    useEffect(() => {
        if (open && dialogRef.current) {
            const btn = dialogRef.current.querySelector<HTMLButtonElement>(".confirm-dialog-cancel");
            btn?.focus();
        }
    }, [open]);

    if (!open) return null;

    const iconMap = {
        danger: "🗑️",
        warning: "⚠️",
        info: "ℹ️",
    };

    return (
        <div className="confirm-overlay" onClick={onCancel}>
            <div
                ref={dialogRef}
                className={`confirm-dialog confirm-${variant}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="confirm-header">
                    <span className="confirm-icon">{iconMap[variant]}</span>
                    <h3 className="confirm-title">{title}</h3>
                </div>
                <div className="confirm-body">{message}</div>
                <div className="confirm-actions">
                    <button
                        className="btn btn-secondary confirm-dialog-cancel"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className={`btn ${variant === "danger" ? "btn-danger" : "btn-primary"}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
