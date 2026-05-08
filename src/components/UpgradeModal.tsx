import { lazy, Suspense } from 'react'
import type { UpgradeModalProps } from '../platform/shared/upgradeTypes'

const UpgradeModalImpl = __PASSGEN_TARGET__ === 'ios'
  ? lazy(() => import('../platform/ios/IOSUpgradeModal'))
  : lazy(() => import('../platform/desktop/DesktopUpgradeModal'))

export default function UpgradeModal(props: UpgradeModalProps) {
  return (
    <Suspense fallback={null}>
      <UpgradeModalImpl {...props} />
    </Suspense>
  )
}
