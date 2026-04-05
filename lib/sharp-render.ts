import sharp from 'sharp'

export type ImageRenderFormat = '9x16' | '4x5' | '1x1' | '16x9'

const FORMAT_DIMENSIONS: Record<ImageRenderFormat, { width: number; height: number }> = {
  '9x16':  { width: 1080, height: 1920 },
  '4x5':   { width: 1080, height: 1350 },
  '1x1':   { width: 1080, height: 1080 },
  '16x9':  { width: 1920, height: 1080 },
}

export async function resizeImage(
  inputBuffer: Buffer,
  format: ImageRenderFormat,
): Promise<Buffer> {
  const { width, height } = FORMAT_DIMENSIONS[format]

  // Auto-rotate based on EXIF orientation before any processing
  const rotatedBuffer = await sharp(inputBuffer).rotate().toBuffer()

  // Background: scale to cover full canvas, blur + darken (same as FFmpeg video approach)
  const bgBuffer = await sharp(rotatedBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .blur(20)
    .modulate({ brightness: 0.65 })
    .toBuffer()

  // Foreground: scale to fit inside canvas (no crop, full image visible)
  const fgBuffer = await sharp(rotatedBuffer)
    .resize(width, height, { fit: 'inside' })
    .toBuffer()

  const fgMeta = await sharp(fgBuffer).metadata()
  const left = Math.round((width - (fgMeta.width ?? width)) / 2)
  const top = Math.round((height - (fgMeta.height ?? height)) / 2)

  return sharp(bgBuffer)
    .composite([{ input: fgBuffer, left, top }])
    .jpeg({ quality: 90 })
    .toBuffer()
}
