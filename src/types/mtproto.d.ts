declare module '@mtproto/core' {
    export interface MTProtoOptions {
        api_id: number;
        api_hash: string;
        storageOptions?: {
            path: string;
        };
    }

    export default class MTProto {
        constructor(options: MTProtoOptions);
        call(method: string, params?: any, options?: any): Promise<any>;
        updates: {
            on(event: string, callback: (message: any) => void): void;
        };
    }
}