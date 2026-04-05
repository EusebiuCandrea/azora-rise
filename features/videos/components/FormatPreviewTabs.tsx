'use client'

import { useState } from 'react'
import { Player } from '@remotion/player'
import { FormatVideo as FormatVideoComponent, FormatVideoProps, OutputFormat } from '@/src/remotion/FormatVideo'
import { Copy, Check } from 'lucide-react'

interface FormatConfig {
  id: OutputFormat
  label: string
  width: number
  height: number
}

const FORMATS: FormatConfig[] = [
  { id: '9x16',  label: '9:16 — Stories / Reels', width: 1080, height: 1920 },
  { id: '4x5',   label: '4:5 — Feed',              width: 1080, height: 1350 },
  { id: '1x1',   label: '1:1 — Pătrat',            width: 1080, height: 1080 },
  { id: '16x9',  label: '16:9 — Landscape',         width: 1920, height: 1080 },
]

interface FormatPreviewTabsProps {
  videoUrl: string
  durationInFrames: number
  filename: string
  assetR2Key: string
}

export function FormatPreviewTabs({
  videoUrl,
  durationInFrames,
  filename,
  assetR2Key: _assetR2Key,
}: FormatPreviewTabsProps) {
  const [activeFormat, setActiveFormat] = useState<OutputFormat>('9x16')
  const [copied, setCopied] = useState(false)

  const format = FORMATS.find((f) => f.id === activeFormat)!
  const baseName = filename.replace(/\.[^.]+$/, '')

  const inputProps: FormatVideoProps = {
    videoUrl,
    outputFormat: activeFormat,
    durationInFrames,
  }

  const cliCommand =
    `npx remotion render FormatVideo-${activeFormat} ` +
    `out/${baseName}-${activeFormat}.mp4 ` +
    `--props '${JSON.stringify(inputProps)}'`

  async function handleCopy() {
    await navigator.clipboard.writeText(cliCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Scale player to fit in UI — max height 480px
  const playerHeight = 480
  const playerWidth = Math.round(playerHeight * (format.width / format.height))

  return (
    <div className="space-y-6">
      {/* Format tabs */}
      <div className="flex items-center gap-1 border-b border-[#E7E5E4]">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFormat(f.id)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeFormat === f.id
                ? 'font-semibold text-[#1C1917] border-[#D4AF37]'
                : 'text-[#78716C] border-transparent hover:text-[#1C1917]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Player */}
      <div className="flex justify-center">
        <div
          className="rounded-xl overflow-hidden border border-[#E7E5E4] shadow-sm bg-black"
          style={{ width: playerWidth, height: playerHeight }}
        >
          <Player
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            component={FormatVideoComponent as any}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            compositionWidth={format.width}
            compositionHeight={format.height}
            fps={30}
            style={{ width: playerWidth, height: playerHeight }}
            controls
            loop
          />
        </div>
      </div>

      {/* CLI command */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[#78716C]">Comandă render local (rulează din directorul azora-rise):</p>
        <div className="flex items-start gap-2">
          <code className="flex-1 block bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg px-4 py-3 text-xs text-[#1C1917] font-mono break-all">
            {cliCommand}
          </code>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] text-xs font-semibold rounded-lg transition-colors flex-shrink-0 mt-1"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5" /> Copiat</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copiază</>
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#78716C]">
          MP4-ul va fi salvat în <code className="bg-[#F5F5F4] px-1 rounded">out/{baseName}-{activeFormat}.mp4</code> · URL valid 1h
        </p>
      </div>
    </div>
  )
}
