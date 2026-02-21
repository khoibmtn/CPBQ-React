"use client";

import { useEffect, useRef } from "react";
import { Trash2, AlertTriangle, Info } from "lucide-react";

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

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onCancel]);

    useEffect(() => {
        if (open && dialogRef.current) {
            const btn = dialogRef.current.querySelector<HTMLButtonElement>(".confirm-dialog-cancel");
            btn?.focus();
        }
    }, [open]);

    if (!open) return null;

    const iconMap = {
        danger: <Trash2 className="w-6 h-6 text-red-500" />,
        warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
        info: <Info className="w-6 h-6 text-blue-500" />,
    };

    const confirmBtnClass = variant === "danger"
        ? "bg-red-600 hover:bg-red-700 text-white"
        : variant === "warning"
            ? "bg-amber-500 hover:bg-amber-600 text-white"
            : "bg-primary-600 hover:bg-primary-700 text-white";

    return (
        <div className="confirm-overlay" onClick={onCancel}>
            <div
                ref={dialogRef}
                className={`confirm-dialog ${variant === "danger" ? "confirm-danger" : ""}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="confirm-header">
                    {iconMap[variant]}
                    <h3 className="confirm-title">{title}</h3>
                </div>
                <div className="confirm-body">{message}</div>
                <div className="confirm-actions">
                    <button
                        className="confirm-dialog-cancel px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${confirmBtnClass}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
