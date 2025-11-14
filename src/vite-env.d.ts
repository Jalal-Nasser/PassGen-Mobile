/// <reference types="vite/client" />

interface PaymentAPI {
	requestActivation: (payload: { email: string; requestId: string }) => Promise<{ success: boolean; error?: string }>
}

declare interface Window {
	electron: {
		payment: PaymentAPI
	}
}
