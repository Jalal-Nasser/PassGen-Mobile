/// <reference types="vite/client" />

interface PaymentAPI {
	requestActivation: (payload: { email: string; requestId: string; paymentMethod?: 'paypal' | 'crypto' }) => Promise<{ success: boolean; error?: string }>
}

interface ClipboardAPI {
	writeText: (text: string) => void
}

declare interface Window {
	electron: {
		payment: PaymentAPI
		clipboard: ClipboardAPI
	}
	electronAPI?: {
		authLogin: (deviceId: string) => Promise<{ ok: boolean }>
		authGetSession: () => Promise<{ email?: string; userId?: string; plan?: string; isPremium?: boolean; expiresAt?: string | null } | null>
		authGetMe: () => Promise<{ userId: string; email: string; plan: string; isPremium: boolean; expiresAt: string | null }>
		authLogout: () => Promise<{ ok: boolean }>
		licenseGetMe: () => Promise<{ email: string; plan: string; isPremium: boolean }>
		licenseRedeem: (payload: { licenseKey: string; deviceId?: string }) => Promise<{ isPremium: boolean; plan: string; expiresAt?: string | null }>
		onAuthUpdated: (handler: (session: any) => void) => () => void
	}
}
