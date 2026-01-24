declare module "@mtproto/core" {
	export interface MTProtoOptions {
		api_id: number;
		api_hash: string;
		storageOptions?: {
			path: string;
		};
	}

	export default class MTProto {
		constructor(options: MTProtoOptions);
		call(
			method: string,
			params?: Record<string, unknown>,
			options?: Record<string, unknown>,
		): Promise<unknown>;
		updates: {
			on(event: string, callback: (message: unknown) => void): void;
		};
	}
}
