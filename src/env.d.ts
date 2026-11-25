/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly PUBLIC_SITE_URL?: string;
	readonly PUBLIC_BLIP_APP_KEY?: string;
	readonly PUBLIC_BLIP_COMMON_URL?: string;
	readonly PUBLIC_PDV_MODE?: 'live' | 'mock' | 'off';
	readonly PDV_MOCK_ADMIN_TOKEN?: string;
	readonly DATABASE_URL?: string;
	readonly PDV_SYNC_TOKEN?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module 'blip-chat-widget' {
	export interface BlipChatButtonConfig {
		color?: string;
		icon?: string;
	}

	export interface BlipChatAuthConfig {
		authType: string;
		userIdentity?: string;
		userPassword?: string;
	}

	export class BlipChat {
		static readonly DEV_AUTH: string;
		static readonly GUEST_AUTH: string;
		static readonly ENTER_EVENT: string;
		static readonly LEAVE_EVENT: string;
		static readonly LOAD_EVENT: string;
		static readonly CUSTOM_SEND_MESSAGE: string;
		static readonly CREATE_ACCOUNT_EVENT: string;

		withAppKey(appKey: string): this;
		withButton(config: BlipChatButtonConfig): this;
		withAuth(config: BlipChatAuthConfig): this;
		withAccount(account: Record<string, unknown>): this;
		withTarget(elementId: string): this;
		withEnvironment(environment: 'production' | 'homolog' | 'local'): this;
		withEventHandler(event: string, handler: () => void): this;
		withCustomStyle(css: string): this;
		withCustomMessageMetadata(metadata: Record<string, string>): this;
		withCustomCommonUrl(url: string): this;
		withCustomSearchParams(params: Record<string, string>): this;
		withoutHistory(): this;
		build(): void;
		toogleChat(): void;
		destroy(): void;
		sendMessage(message: Record<string, unknown>): void;
		sendCommand(command: Record<string, unknown>): void;
	}
}
