import { lazy, Suspense } from 'react'
import type { UpgradeModalProps } from '../platform/shared/upgradeTypes'

const UpgradeModalImpl = lazy(() => import('../platform/ios/IOSUpgradeModal'))

export default function UpgradeModal(props: UpgradeModalProps) {
  return (
    <Suspense fallback={null}>
      <UpgradeModalImpl {...props} />
    </Suspense>
  )
}
