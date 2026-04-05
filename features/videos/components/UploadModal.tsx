'use client'

import { useState } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductPicker, PickableProduct } from './ProductPicker'
import { AdPicker, PickableAd } from './AdPicker'
import { AssetUploader } from './AssetUploader'
import { useRouter } from 'next/navigation'

interface UploadModalProps {
  products: PickableProduct[]
  onClose: () => void
}

type Step = 'product' | 'ad' | 'upload'

export function UploadModal({ products, onClose }: UploadModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('product')
  const [selectedProduct, setSelectedProduct] = useState<PickableProduct | null>(null)
  const [ads, setAds] = useState<PickableAd[]>([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [selectedAd, setSelectedAd] = useState<PickableAd | null>(null)
  async function handleProductContinue() {
    if (!selectedProduct) return
    setLoadingAds(true)
    setSelectedAd(null)
    try {
      const res = await fetch(`/api/video-ads?productId=${selectedProduct.id}`)
      const data = await res.json()
      setAds(res.ok ? data : [])
    } catch {
      setAds([])
    } finally {
      setLoadingAds(false)
    }
    setStep('ad')
  }

  function handleUploaded() {
    router.refresh()
  }

  const stepTitles: Record<Step, string> = {
    product: 'Selectează produsul',
    ad: 'Selectează reclama',
    upload: 'Încarcă fișier',
  }

  const steps: Step[] = ['product', 'ad', 'upload']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E5E4]">
          <div className="flex items-center gap-3">
            {step !== 'product' && (
              <button
                onClick={() => setStep(step === 'upload' ? 'ad' : 'product')}
                className="text-[#78716C] hover:text-[#1C1917] transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-base font-bold text-[#1C1917]">{stepTitles[step]}</h2>
          </div>
          <button onClick={onClose} className="text-[#78716C] hover:text-[#1C1917] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                step === s ? 'bg-[#D4AF37]' : i < steps.indexOf(step) ? 'bg-[#D4AF37]/40' : 'bg-[#E7E5E4]'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {step === 'product' && (
            <>
              <ProductPicker
                products={products}
                selectedId={selectedProduct?.id ?? null}
                onSelect={setSelectedProduct}
              />
              <div className="mt-5">
                <Button
                  onClick={handleProductContinue}
                  disabled={!selectedProduct || loadingAds}
                  className="w-full bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold h-10"
                >
                  {loadingAds ? 'Se încarcă...' : 'Continuă'}
                </Button>
              </div>
            </>
          )}

          {step === 'ad' && selectedProduct && (
            <>
              <AdPicker
                productId={selectedProduct.id}
                productName={selectedProduct.title}
                ads={ads}
                selectedId={selectedAd?.id ?? null}
                onSelect={setSelectedAd}
              />
              <div className="mt-5">
                <Button
                  onClick={() => setStep('upload')}
                  disabled={!selectedAd}
                  className="w-full bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold h-10"
                >
                  Continuă
                </Button>
              </div>
            </>
          )}

          {step === 'upload' && selectedAd && selectedProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#78716C] bg-[#F5F5F4] px-3 py-2 rounded-lg">
                <span>📦 {selectedProduct.title}</span>
                <span>→</span>
                <span>🎬 {selectedAd.name}</span>
              </div>
              <AssetUploader onUploaded={handleUploaded} adId={selectedAd.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
