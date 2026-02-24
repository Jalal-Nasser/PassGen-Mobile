import { supabase } from './supabase'
import { Capacitor } from '@capacitor/core'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'
import { SignInWithApple, SignInWithAppleResponse, SignInWithAppleOptions } from '@capacitor-community/apple-sign-in'
import { logInToRevenueCat, logOutFromRevenueCat } from './revenuecat'

export async function initializeAuth() {
  if (Capacitor.isNativePlatform()) {
    // Note: Initialize GoogleAuth. The client ID must be configured in capacitor.config.ts or natively
    GoogleAuth.initialize({
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    })
  }
}

export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    try {
      const googleUser = await GoogleAuth.signIn()
      if (googleUser.authentication.idToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleUser.authentication.idToken,
        })
        if (error) throw error
        if (data && data.user) await logInToRevenueCat(data.user.id)
        return data
      } else {
        throw new Error('No ID token from Google')
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error)
      throw error
    }
  } else {
    // Web fallback
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) throw error
    return data
  }
}

export async function signInWithApple() {
  if (Capacitor.isNativePlatform()) {
    try {
      const options: SignInWithAppleOptions = {
        clientId: import.meta.env.VITE_APPLE_CLIENT_ID || 'com.mdeploy.passgen',
        redirectURI: window.location.origin, // Adjust if needed
        scopes: 'email name',
        state: '12345',
        nonce: 'nonce',
      }
      
      const result: SignInWithAppleResponse = await SignInWithApple.authorize(options)
      
      if (result.response && result.response.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: result.response.identityToken,
        })
        if (error) throw error
        if (data && data.user) await logInToRevenueCat(data.user.id)
        return data
      } else {
        throw new Error('No identity token from Apple')
      }
    } catch (error) {
      console.error('Apple Sign-In Error:', error)
      throw error
    }
  } else {
    // Web fallback
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) throw error
    return data
  }
}

export async function signOut() {
  await logOutFromRevenueCat()
  await supabase.auth.signOut()
  if (Capacitor.isNativePlatform()) {
    try {
      await GoogleAuth.signOut()
    } catch (e) {
      // Ignore errors if wasn't signed in with Google
    }
  }
}

export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
