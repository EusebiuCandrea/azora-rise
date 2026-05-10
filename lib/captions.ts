export interface CaptionWord {
  word: string
  start: number
  end: number
}

export interface CaptionLine {
  words: CaptionWord[]
  start: number
  end: number
}

export function groupWordsIntoLines(words: CaptionWord[], maxWordsPerLine = 4): CaptionLine[] {
  const lines: CaptionLine[] = []
  let current: CaptionWord[] = []

  for (const word of words) {
    const prev = current[current.length - 1]
    const gap = prev ? word.start - prev.end : 0

    if (current.length >= maxWordsPerLine || gap > 0.6) {
      if (current.length > 0) {
        lines.push({ words: current, start: current[0].start, end: current[current.length - 1].end })
      }
      current = []
    }
    current.push(word)
  }

  if (current.length > 0) {
    lines.push({ words: current, start: current[0].start, end: current[current.length - 1].end })
  }

  return lines
}

function toASSTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.round((seconds % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

// ASS colour ABGR: purple #7C3AED → &H00ED3A7C&
const PURPLE_ASS = '&H00ED3A7C&'

const CAPTION_Y_FRACTION: Record<string, number> = {
  '9x16': 0.62,
  '4x5':  0.72,
  '1x1':  0.75,
  '16x9': 0.84,
}

const VIDEO_DIMS: Record<string, { w: number; h: number }> = {
  '9x16': { w: 1080, h: 1920 },
  '4x5':  { w: 1080, h: 1350 },
  '1x1':  { w: 1080, h: 1080 },
  '16x9': { w: 1920, h: 1080 },
}

export function generateASSSubtitles(lines: CaptionLine[], format = '9x16'): string {
  const dims = VIDEO_DIMS[format] ?? VIDEO_DIMS['9x16']
  const yFraction = CAPTION_Y_FRACTION[format] ?? 0.62
  const fontSize = format === '16x9' ? 56 : 72
  const marginV = Math.round(dims.h * (1 - yFraction))

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${dims.w}
PlayResY: ${dims.h}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HAA000000,-1,0,0,0,100,100,2,0,3,0,0,2,20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`

  const events: string[] = []

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const nextLine = lines[li + 1]

    for (let i = 0; i < line.words.length; i++) {
      const activeWord = line.words[i]
      const nextWord = line.words[i + 1]

      // Extend last word of a line to next line's start to eliminate gaps
      const displayEnd = nextWord
        ? nextWord.start
        : nextLine
          ? nextLine.start
          : line.end + 0.1

      // Full phrase — active word gets purple color via inline \1c override only
      const text = line.words.map((w, j) => {
        const upper = w.word.toUpperCase()
        if (j === i) return `{\\1c${PURPLE_ASS}}${upper}{\\1c&H00FFFFFF&}`
        return upper
      }).join('  ')

      events.push(
        `Dialogue: 0,${toASSTimestamp(activeWord.start)},${toASSTimestamp(displayEnd)},Cap,,0,0,0,,${text}`
      )
    }
  }

  return header + '\n' + events.join('\n')
}
