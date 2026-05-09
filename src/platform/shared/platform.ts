import { Capacitor } from '@capacitor/core'

export type PassGenBuildTarget = 'ios'

export function getBuildTarget(): PassGenBuildTarget {
  return 'ios'
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
