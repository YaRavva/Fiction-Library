"use client";

import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	MotionDialog,
	MotionDialogContent,
	MotionDialogDescription,
	MotionDialogFooter,
	MotionDialogHeader,
	MotionDialogTitle,
	MotionDialogTrigger,
} from "@/components/ui/motion-dialog";
import type { AnimationVariant } from "@/lib/popup-variants";

interface AlertDialogMotionProps {
	title: string;
	description: string;
	buttonText?: string;
	variant?: "default" | "destructive" | "warning" | "success";
	animation?: AnimationVariant;
	onClose?: () => void;
	children: React.ReactNode;
}

const variantConfig = {
	default: {
		icon: Info,
		iconColor: "text-blue-500",
		buttonVariant: "default" as const,
	},
	destructive: {
		icon: XCircle,
		iconColor: "text-destructive",
		buttonVariant: "destructive" as const,
	},
	warning: {
		icon: AlertTriangle,
		iconColor: "text-yellow-500",
		buttonVariant: "default" as const,
	},
	success: {
		icon: CheckCircle,
		iconColor: "text-green-500",
		buttonVariant: "default" as const,
	},
};

export function AlertDialogMotion({
	title,
	description,
	buttonText = "OK",
	variant = "default",
	animation = "ripple",
	onClose,
	children,
}: AlertDialogMotionProps) {
	const [open, setOpen] = useState(false);

	const config = variantConfig[variant];
	const Icon = config.icon;

	const handleClose = () => {
		if (onClose) {
			onClose();
		}
		setOpen(false);
	};

	return (
		<MotionDialog animation={animation}>
			<MotionDialogTrigger asChild onClick={() => setOpen(true)}>
				{children}
			</MotionDialogTrigger>

			{open && (
				<MotionDialogContent>
					<MotionDialogHeader showCloseButton={false}>
						<div className="flex items-center gap-3 mb-2">
							<Icon className={`h-6 w-6 ${config.iconColor}`} />
							<MotionDialogTitle className="text-left">
								{title}
							</MotionDialogTitle>
						</div>
						<MotionDialogDescription className="text-left">
							{description}
						</MotionDialogDescription>
					</MotionDialogHeader>

					<MotionDialogFooter>
						<Button
							variant={config.buttonVariant}
							onClick={handleClose}
							className="w-full"
						>
							{buttonText}
						</Button>
					</MotionDialogFooter>
				</MotionDialogContent>
			)}
		</MotionDialog>
	);
}

// Хук для программного вызова alert диалога
export function useAlertDialog() {
	const [dialogState, setDialogState] = useState<{
		open: boolean;
		title: string;
		description: string;
		variant: "default" | "destructive" | "warning" | "success";
		animation: AnimationVariant;
		onClose?: () => void;
	} | null>(null);

	const alert = (options: {
		title: string;
		description: string;
		variant?: "default" | "destructive" | "warning" | "success";
		animation?: AnimationVariant;
		onClose?: () => void;
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

	const AlertDialogComponent = dialogState ? (
		<MotionDialog animation={dialogState.animation}>
			<MotionDialogContent>
				<MotionDialogHeader showCloseButton={false}>
					<div className="flex items-center gap-3 mb-2">
						{(() => {
							const config = variantConfig[dialogState.variant];
							const Icon = config.icon;
							return <Icon className={`h-6 w-6 ${config.iconColor}`} />;
						})()}
						<MotionDialogTitle className="text-left">
							{dialogState.title}
						</MotionDialogTitle>
					</div>
					<MotionDialogDescription className="text-left">
						{dialogState.description}
					</MotionDialogDescription>
				</MotionDialogHeader>

				<MotionDialogFooter>
					<Button
						variant={variantConfig[dialogState.variant].buttonVariant}
						onClick={() => {
							if (dialogState.onClose) {
								dialogState.onClose();
							}
							closeDialog();
						}}
						className="w-full"
					>
						OK
					</Button>
				</MotionDialogFooter>
			</MotionDialogContent>
		</MotionDialog>
	) : null;

	return { alert, AlertDialogComponent };
}
