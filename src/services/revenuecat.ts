import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { Capacitor } from '@capacitor/core'

/**
 * Configure RevenueCat safely. It only makes sense to configure RC 
 * if we're on a native platform (iOS/Android).
 */
export async function setupRevenueCat(userId?: string) {
  if (!Capacitor.isNativePlatform()) return

  // Log level for debugging
  await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })

  try {
    if (Capacitor.getPlatform() === 'ios') {
      await Purchases.configure({
        apiKey: import.meta.env.VITE_REVENUECAT_IOS_KEY || 'appl_xxx', // Replace in Dashboard
        appUserID: userId,
      })
    } else if (Capacitor.getPlatform() === 'android') {
      await Purchases.configure({
        apiKey: import.meta.env.VITE_REVENUECAT_ANDROID_KEY || 'goog_xxx', 
        appUserID: userId,
      })
    }
  } catch (error) {
    console.error('Failed to configure RevenueCat:', error)
  }
}

/**
 * Sync Supabase user ID with RevenueCat
 */
export async function logInToRevenueCat(userId: string) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { customerInfo } = await Purchases.logIn({ appUserID: userId })
    return customerInfo
  } catch (error) {
    console.error('RevenueCat Login error:', error)
  }
}

export async function logOutFromRevenueCat() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Purchases.logOut()
  } catch (error) {
    console.error('RevenueCat LogOut error:', error)
  }
}

/**
 * Get Offerings (Plans) from RevenueCat
 */
export async function getSubscriptionOfferings() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const offerings = await Purchases.getOfferings()
    return offerings.current // The "Default" offering mapped in RC dashboard
  } catch (error) {
    console.error('Failed to get offerings:', error)
    return null
  }
}

export async function purchasePackage(packageToBuy: any) {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToBuy })
    return customerInfo
  } catch (error: any) {
    // Error code 1 usually means "User Cancelled"
    if (error.code !== 1) console.error('Purchase Failed:', error)
    throw error
  }
}

export async function checkPremiumStatus(): Promise<'pro' | 'cloud' | 'free'> {
  if (!Capacitor.isNativePlatform()) return 'free'
  try {
    const customerInfo = await Purchases.getCustomerInfo()
    if (customerInfo.customerInfo.entitlements.active['cloud']) return 'cloud'
    if (customerInfo.customerInfo.entitlements.active['pro']) return 'pro'
    return 'free'
  } catch (error) {
    console.error('Status check error:', error)
    return 'free'
  }
}
