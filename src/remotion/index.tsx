import { Composition } from 'remotion'
import { FormatVideo as FormatVideoComp, FormatVideoProps } from './FormatVideo'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FormatVideo = FormatVideoComp as any

const defaultProps: FormatVideoProps = {
  videoUrl:
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  outputFormat: '9x16',
  durationInFrames: 900,
}

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="FormatVideo-9x16"
      component={FormatVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={900}
      defaultProps={{ ...defaultProps, outputFormat: '9x16' }}
    />
    <Composition
      id="FormatVideo-4x5"
      component={FormatVideo}
      width={1080}
      height={1350}
      fps={30}
      durationInFrames={900}
      defaultProps={{ ...defaultProps, outputFormat: '4x5' }}
    />
    <Composition
      id="FormatVideo-1x1"
      component={FormatVideo}
      width={1080}
      height={1080}
      fps={30}
      durationInFrames={900}
      defaultProps={{ ...defaultProps, outputFormat: '1x1' }}
    />
    <Composition
      id="FormatVideo-16x9"
      component={FormatVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={900}
      defaultProps={{ ...defaultProps, outputFormat: '16x9' }}
    />
  </>
)
