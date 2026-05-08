import { Capacitor } from '@capacitor/core'

export type PassGenBuildTarget = 'desktop' | 'ios'

export function getBuildTarget(): PassGenBuildTarget {
  return typeof __PASSGEN_TARGET__ === 'string' ? __PASSGEN_TARGET__ : 'desktop'
}

export function isIOSBuild(): boolean {
  return getBuildTarget() === 'ios'
}

export function isIOSRuntime(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

export function isIOSAppStoreSurface(): boolean {
  return isIOSBuild() || isIOSRuntime()
}
