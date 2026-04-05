import { spawn } from 'child_process'

export type RenderFormat = '9x16' | '4x5' | '1x1' | '16x9'

function buildArgs(inputPath: string, outputPath: string, format: RenderFormat): string[] {
  const base = ['-i', inputPath, '-y']
  // ultrafast + threads 1 + 720p to stay within Railway Trial 512MB RAM
  const encode = [
    '-c:v', 'libx264', '-crf', '26', '-preset', 'ultrafast',
    '-threads', '1', '-max_muxing_queue_size', '512',
    '-movflags', '+faststart',
  ]

  switch (format) {
    case '9x16':
      return [...base,
        '-vf', 'crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=720:1280',
        ...encode, outputPath]

    case '4x5':
      return [...base,
        '-vf', 'crop=min(iw\\,ih*4/5):min(ih\\,iw*5/4),scale=720:900',
        ...encode, outputPath]

    case '1x1':
      return [...base,
        '-filter_complex',
        '[0:v]split[a][b];[a]scale=720:720:force_original_aspect_ratio=increase,crop=720:720,boxblur=luma_radius=15:luma_power=2,eq=brightness=-0.35[bg];[b]scale=406:720[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[out]',
        '-map', '[out]', '-map', '0:a?',
        ...encode, outputPath]

    case '16x9':
      return [...base,
        '-filter_complex',
        '[0:v]split[a][b];[a]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=luma_radius=15:luma_power=2,eq=brightness=-0.35[bg];[b]scale=406:720[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[out]',
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
