'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SessionsRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/sessions/pppoe')
  }, [router])

  return (
    <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
      Mengalihkan ke Monitoring Sesi PPPoE...
    </div>
  )
}
