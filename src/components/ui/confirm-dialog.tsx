"use client";

import { useState } from "react";
import {
  MotionDialog,
  MotionDialogTrigger,
  MotionDialogContent,
  MotionDialogHeader,
  MotionDialogTitle,
  MotionDialogDescription,
  MotionDialogFooter,
} from "@/components/ui/motion-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";
import type { AnimationVariant } from "@/lib/popup-variants";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive" | "warning" | "info";
  animation?: AnimationVariant;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  children: React.ReactNode;
}

const variantConfig = {
  default: {
    icon: CheckCircle,
    iconColor: "text-primary",
    confirmVariant: "default" as const,
  },
  destructive: {
    icon: XCircle,
    iconColor: "text-destructive",
    confirmVariant: "destructive" as const,
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
    confirmVariant: "default" as const,
  },
  info: {
    icon: Info,
    iconColor: "text-blue-500",
    confirmVariant: "default" as const,
  },
};

export function ConfirmDialog({
  title,
  description,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  variant = "default",
  animation = "ripple",
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      console.error("Error in confirm dialog:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    setOpen(false);
  };

  return (
    <MotionDialog animation={animation} open={open} onOpenChange={setOpen}>
      <MotionDialogTrigger asChild>
        {children}
      </MotionDialogTrigger>
      
      <MotionDialogContent>
        <MotionDialogHeader showCloseButton={false}>
          <div className="flex items-center gap-3 mb-2">
            <Icon className={`h-6 w-6 ${config.iconColor}`} />
            <MotionDialogTitle className="text-left">{title}</MotionDialogTitle>
          </div>
          <MotionDialogDescription className="text-left">
            {description}
          </MotionDialogDescription>
        </MotionDialogHeader>
        
        <MotionDialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Выполняется..." : confirmText}
          </Button>
        </MotionDialogFooter>
      </MotionDialogContent>
    </MotionDialog>
  );
}

// Хук для программного вызова диалога подтверждения
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: "default" | "destructive" | "warning" | "info";
    animation: AnimationVariant;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  } | null>(null);

  const confirm = (options: {
    title: string;
    description: string;
    variant?: "default" | "destructive" | "warning" | "info";
    animation?: AnimationVariant;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  }) => {
    setDialogState({
      open: true,
      variant: "default",
      animation: "ripple",
      ...options,
    });
  };

  const closeDialog = () => {
    setDialogState(null);
  };

  const ConfirmDialogComponent = dialogState ? (
    <MotionDialog animation={dialogState.animation}>
      <MotionDialogContent>
        <MotionDialogHeader showCloseButton={false}>
          <div className="flex items-center gap-3 mb-2">
            {(() => {
              const config = variantConfig[dialogState.variant];
              const Icon = config.icon;
              return <Icon className={`h-6 w-6 ${config.iconColor}`} />;
            })()}
            <MotionDialogTitle className="text-left">{dialogState.title}</MotionDialogTitle>
          </div>
          <MotionDialogDescription className="text-left">
            {dialogState.description}
          </MotionDialogDescription>
        </MotionDialogHeader>
        
        <MotionDialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (dialogState.onCancel) {
                dialogState.onCancel();
              }
              closeDialog();
            }}
          >
            Отмена
          </Button>
          <Button
            variant={variantConfig[dialogState.variant].confirmVariant}
            onClick={async () => {
              await dialogState.onConfirm();
              closeDialog();
            }}
          >
            Подтвердить
          </Button>
        </MotionDialogFooter>
      </MotionDialogContent>
    </MotionDialog>
  ) : null;

  return { confirm, ConfirmDialogComponent };
}