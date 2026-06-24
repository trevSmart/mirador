import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { SfIcon, type SfSprite } from './SfIcon'

/* ButtonIcon — an icon-only button. The glyph can come from three sources,
   in priority order:
     1. `icon`     → a Salesforce SLDS id, "sprite:symbol" (e.g. "utility:add",
                     "standard:case"). Rendered via SfIcon.
     2. `src`      → a normal image URL (png/svg). Rendered as <img>.
     3. `children` → any node (e.g. an inline custom <svg>), for glyphs that are
                     neither SLDS nor a standalone image.

   It is a real <button>: it forwards onClick, disabled, title, etc. An
   accessible name is required via `aria-label` (or `title`). */

interface ButtonIconProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Salesforce SLDS id as "sprite:symbol", e.g. "utility:refresh". */
  icon?: string
  /** Image URL (png/svg) used instead of an SLDS icon. */
  src?: string
  /** Custom glyph node (inline svg, etc.) when not SLDS nor an image. */
  children?: ReactNode
  /** Pixel size of the glyph (not the button box). */
  size?: number
}

function parseSldsId(id: string): { sprite: SfSprite; symbol: string } | null {
  const [sprite, symbol] = id.split(':')
  if (!sprite || !symbol) return null
  return { sprite: sprite as SfSprite, symbol }
}

export function ButtonIcon({
  icon,
  src,
  children,
  size = 18,
  type = 'button',
  className,
  ...rest
}: ButtonIconProps) {
  const slds = icon ? parseSldsId(icon) : null

  return (
    <button type={type} className={className} {...rest}>
      {slds ? (
        <SfIcon sprite={slds.sprite} symbol={slds.symbol} size={size} />
      ) : src ? (
        <img src={src} alt="" width={size} height={size} aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  )
}
