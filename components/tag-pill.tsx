import { HTMLAttributes } from 'react'

interface TagPillProps extends HTMLAttributes<HTMLSpanElement> {
  // Lemon fill — reserved for the e1RM tag and "Up next" chip per the visual tokens
  // (only ever on a filled shape with dark text, never as text on the light background).
  highlight?: boolean
}

export default function TagPill({ highlight = false, className = '', ...props }: TagPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-mono font-medium text-ink ${
        highlight ? 'bg-highlight' : 'bg-tag-fill'
      } ${className}`}
      {...props}
    />
  )
}
