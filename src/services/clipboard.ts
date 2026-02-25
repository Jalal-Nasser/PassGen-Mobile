export async function copyText(text: string): Promise<boolean> {
  const dbg = (msg: string) => {
    try {
      // Only log in dev builds to avoid noisy production consoles
      if ((import.meta as any)?.env?.DEV) console.warn('[clipboard]', msg)
    } catch {}
  }
  try {
    // 1) Preferred: native bridge clipboard
    if (typeof window !== 'undefined' && (window as any).nativeBridge?.clipboard?.writeText) {
      try {
        const ok = await (window as any).nativeBridge.clipboard.writeText(text)
        dbg(`nativeBridge.writeText -> ${ok ? 'ok' : 'fail'}`)
        if (ok) return true
      } catch (e:any) {
        dbg(`nativeBridge.writeText error: ${e?.message || e}`)
      }
    }

    // 2) Web Clipboard API (may require user gesture/permissions, secure context)
    if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
      try {
        await (navigator as any).clipboard.writeText(text)
        dbg('navigator.clipboard.writeText -> ok')
        return true
      } catch (e:any) {
        dbg(`navigator.clipboard.writeText error: ${e?.message || e}`)
      }
    } else {
      dbg(`navigator.clipboard not available; secureContext=${(globalThis as any).isSecureContext}`)
    }

    // 3) Fallback: execCommand('copy') using a hidden textarea
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      try {
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        dbg(`execCommand('copy') -> ${ok ? 'ok' : 'fail'}`)
        if (ok) return true
      } catch (e:any) {
        dbg(`execCommand copy error: ${e?.message || e}`)
        try { document.body.removeChild(ta) } catch {}
      }
    }
  } catch (err:any) {
    dbg(`unexpected error: ${err?.message || err}`)
  }
  return false
}
