import { lazy } from 'react'

const CapaManagement = lazy(() => import('@/pages/capa/capa-management'))

export default function ActionsPage() {
  return <CapaManagement />
}
