/// <reference types="vite/client" />

declare module '*?raw' {
	const content: string
	export default content
}

interface ClipboardAPI {
	writeText: (text: string) => void
}

declare interface Window {
	nativeBridge: {
		clipboard: ClipboardAPI
	}
	nativeBridgeAPI?: {
		authLogin: (deviceId: string) => Promise<{ ok: boolean }>
		authGetSession: () => Promise<{ email?: string; userId?: string; plan?: string; isPremium?: boolean; expiresAt?: string | null } | null>
		authGetMe: () => Promise<{ userId: string; email: string; plan: string; isPremium: boolean; expiresAt: string | null }>
		authLogout: () => Promise<{ ok: boolean }>
		licenseGetMe: () => Promise<{ email: string; plan: string; isPremium: boolean }>
		licenseRedeem: (payload: { licenseKey: string; deviceId?: string }) => Promise<{ isPremium: boolean; plan: string; expiresAt?: string | null }>
		openExternal: (url: string) => Promise<{ ok: boolean }>
		settingsGet: () => Promise<{ minimizeToTray: boolean }>
		settingsSet: (payload: { minimizeToTray?: boolean }) => Promise<{ minimizeToTray: boolean }>
		storageSupabaseTest: (config: any) => Promise<{ ok: boolean; error?: string }>
		storageSupabaseUpload: (config: any, data: string, retainCount?: number) => Promise<{ versionId: string }>
		storageSupabaseDownload: (config: any, versionId?: string) => Promise<string>
		storageSupabaseListVersions: (config: any) => Promise<any[]>
		storageSupabaseRestoreVersion: (config: any, versionId: string) => Promise<string>
		devSecretGenerate: () => Promise<{ base64Url: string; hex: string }>
		devSecretSelectProject: () => Promise<{ success: boolean; folder?: string; hasEnv?: boolean; envPath?: string }>
		devSecretInjectEnv: (payload: { folder: string; key: string; value: string }) => Promise<{ success: boolean; envPath?: string; updated?: boolean; created?: boolean }>
		onAuthUpdated: (handler: (session: any) => void) => () => void
	}
}
