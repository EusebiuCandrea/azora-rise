'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { UploadModal } from './UploadModal'
import { PickableProduct } from './ProductPicker'

interface AssetUploaderSectionProps {
  products: PickableProduct[]
}

export function AssetUploaderSection({ products }: AssetUploaderSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-sm font-semibold rounded-lg transition-colors"
      >
        <Upload className="w-3.5 h-3.5" strokeWidth={2} />
        Încarcă fișiere
      </button>

      {open && (
        <UploadModal
          products={products}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
