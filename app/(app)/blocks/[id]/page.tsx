import { redirect } from 'next/navigation'

// Block detail was never restyled for the design rebuild and had no board of its own; its
// useful content (peaking label, phase progress) now lives on the Training tab's block card.
// Redirects rather than 404s, so any stale link/bookmark lands somewhere real.
export default function BlockDetailPage() {
  redirect('/programmes')
}
