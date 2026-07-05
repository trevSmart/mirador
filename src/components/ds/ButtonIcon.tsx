import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AppIcon } from './AppIcon'
import type { AppIconName } from './app-icon-names.generated'

/* ButtonIcon — an icon-only button. The glyph can come from three sources,
   in priority order:
     1. `icon`     → an app icon name (a file in src/assets/icons/,
                     e.g. "refresh", "close"). Rendered via AppIcon.
     2. `src`      → a normal image URL (png/svg). Rendered as <img>.
     3. `children` → any node, for glyphs that are neither an app icon nor a
                     standalone image.

   It is a real <button>: it forwards onClick, disabled, title, etc. An
   accessible name is required via `aria-label` (or `title`). */

interface ButtonIconProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** App icon name (file in src/assets/icons/), e.g. "refresh". */
  icon?: AppIconName
  /** Image URL (png/svg) used instead of an app icon. */
  src?: string
  /** Custom glyph node when not an app icon nor an image. */
  children?: ReactNode
  /** Pixel size of the glyph (not the button box). */
  size?: number
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
  return (
    <button type={type} className={className} {...rest}>
      {icon ? (
        <AppIcon name={icon} size={size} />
      ) : src ? (
        <img src={src} alt="" width={size} height={size} aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  )
}
