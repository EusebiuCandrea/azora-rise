'use client'

import { useState } from 'react'
import { AssetUploader } from './AssetUploader'
import { useRouter } from 'next/navigation'

export function AssetUploaderSection() {
  const router = useRouter()
  const [key, setKey] = useState(0)

  function handleUploaded() {
    // Refresh server component to show new asset
    router.refresh()
    setKey((k) => k + 1)
  }

  return <AssetUploader key={key} onUploaded={handleUploaded} />
}
