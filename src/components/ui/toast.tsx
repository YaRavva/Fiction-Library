"use client";

import * as React from "react";

type ToastProps = {
	message: string;
	duration?: number;
	onClose?: () => void;
};

export function Toast({ message, duration = 4000, onClose }: ToastProps) {
	React.useEffect(() => {
		const t = setTimeout(() => onClose?.(), duration);
		return () => clearTimeout(t);
	}, [duration, onClose]);

	return (
		<div className="fixed bottom-6 right-6 z-50">
			<div className="bg-gray-800 text-white px-4 py-2 rounded shadow-lg">
				{message}
			</div>
		</div>
	);
}
