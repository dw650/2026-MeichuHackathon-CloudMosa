/** Keeps --app-h equal to the real innerHeight (the layout never assumes 320px; docs/03 §2). */
export function syncViewportHeight(win: Window = window): () => void {
  const apply = () => {
    win.document.documentElement.style.setProperty('--app-h', `${win.innerHeight}px`)
  }
  apply()
  win.addEventListener('resize', apply)
  return () => win.removeEventListener('resize', apply)
}
