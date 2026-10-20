import { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'destructive'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

// Visual tokens per CLAUDE.md's Design handoff section. Primary/destructive get the
// 56-60px primary tap target; secondary (outlined) gets the 44px minimum.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'h-14 px-6 text-base bg-action text-ink hover:brightness-95',
  secondary: 'h-11 px-5 text-sm bg-transparent text-ink border border-border hover:bg-tag-fill',
  destructive: 'h-14 px-6 text-base bg-error text-white hover:brightness-110',
}

export default function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-[var(--radius-control)] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}
