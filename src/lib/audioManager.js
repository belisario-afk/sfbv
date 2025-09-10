// Optional HTMLAudio fallback for preview clips (not used by default)
export function playPreview(url) {
  if (!url) return
  const a = new Audio(url)
  a.volume = 0.9
  a.play().catch(()=>{})
  return () => { a.pause(); a.src=''; }
}