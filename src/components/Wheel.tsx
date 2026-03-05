import type { Prize } from '../lib/types'

const QUADRANTS: Prize[] = [
  'Classic Cold Coffee',
  'Virgin Mojito',
  'Peach Iced Tea',
  'Masala Lemonade',
]

export function Wheel({ spinning }: { spinning: boolean }) {
  return (
    <div className={spinning ? 'wheel wheel--spinning' : 'wheel'} aria-label="Spin wheel">
      <div className="wheel__disc" />
      <div className="wheel__labels">
        {QUADRANTS.map((p) => (
          <div key={p} className="wheel__label">
            {p}
          </div>
        ))}
      </div>
      <div className="wheel__pointer" />
    </div>
  )
}
