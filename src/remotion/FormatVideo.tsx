import { AbsoluteFill, Video, useVideoConfig } from 'remotion'

export type OutputFormat = '9x16' | '4x5' | '1x1' | '16x9'

export interface FormatVideoProps {
  videoUrl: string
  outputFormat: OutputFormat
  durationInFrames: number
}

export const FormatVideo: React.FC<FormatVideoProps> = ({ videoUrl, outputFormat }) => {
  const { height } = useVideoConfig()

  // 9x16 and 4x5: fill canvas with cover crop
  if (outputFormat === '9x16' || outputFormat === '4x5') {
    return (
      <AbsoluteFill>
        <Video
          src={videoUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </AbsoluteFill>
    )
  }

  // 1x1 and 16x9: blurred backdrop + centered sharp portrait column
  const portraitWidth = Math.round(height * (9 / 16))

  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {/* Blurred background — full canvas */}
      <AbsoluteFill>
        <Video
          src={videoUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(24px) brightness(0.35)',
            transform: 'scale(1.2)',
          }}
        />
      </AbsoluteFill>

      {/* Sharp centered column */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: portraitWidth,
          overflow: 'hidden',
        }}
      >
        <Video
          src={videoUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </AbsoluteFill>
  )
}
