import { spawn } from 'child_process'

export type RenderFormat = '9x16' | '4x5' | '1x1' | '16x9'

function buildArgs(inputPath: string, outputPath: string, format: RenderFormat): string[] {
  const base = ['-i', inputPath, '-y']
  const encode = [
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
    '-movflags', '+faststart',
  ]

  switch (format) {
    case '9x16':
      return [...base,
        '-vf', 'crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=1080:1920',
        ...encode, outputPath]

    case '4x5':
      return [...base,
        '-vf', 'crop=min(iw\\,ih*4/5):min(ih\\,iw*5/4),scale=1080:1350',
        ...encode, outputPath]

    case '1x1':
      return [...base,
        '-filter_complex',
        '[0:v]split[a][b];[a]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=luma_radius=15:luma_power=2,eq=brightness=-0.35[bg];[b]scale=608:1080[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[out]',
        '-map', '[out]', '-map', '0:a?',
        ...encode, outputPath]

    case '16x9':
      return [...base,
        '-filter_complex',
        '[0:v]split[a][b];[a]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=luma_radius=15:luma_power=2,eq=brightness=-0.35[bg];[b]scale=608:1080[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[out]',
        '-map', '[out]', '-map', '0:a?',
        ...encode, outputPath]
  }
}

export function renderVideo(inputPath: string, outputPath: string, format: RenderFormat): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = buildArgs(inputPath, outputPath, format)
    const proc = spawn('ffmpeg', args)

    const stderr: string[] = []
    proc.stderr.on('data', (chunk) => stderr.push(chunk.toString()))

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited with code ${code}:\n${stderr.join('')}`))
    })

    proc.on('error', reject)
  })
}
