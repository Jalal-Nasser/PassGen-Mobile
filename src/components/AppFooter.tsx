
import { useState } from 'react'

function AppFooter() {
  const year = new Date().getFullYear()
  const [checking, setChecking] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<string|null>(null)

  const checkForUpdate = async () => {
    setChecking(true)
    setUpdateMsg(null)
    try {
      const res = await fetch('https://api.github.com/repos/Jalal-Nasser/PassGen/releases/latest')
      if (!res.ok) throw new Error('Failed to fetch release info')
      const data = await res.json()
      const latest = data.tag_name?.replace(/^v/, '')
      const url = data.html_url
      // @ts-ignore
      const current = (window as any).appVersion || (import.meta as any)?.env?.npm_package_version || '1.0.0'
      const parse = (v:string)=>{
        const m = (v||'0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/)
        return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0,0,0]
      }
      const newer = (a:string,b:string)=>{
        const [A1,A2,A3] = parse(a), [B1,B2,B3] = parse(b)
        if (A1!==B1) return A1>B1
        if (A2!==B2) return A2>B2
        return A3>B3
      }
      if (latest && newer(latest, current)) {
        setUpdateMsg(`New version ${latest} available! ` + url)
        if (window.confirm(`A new version (${latest}) is available!\n\nGo to download page?`)) {
          window.open(url, '_blank')
        }
      } else {
        setUpdateMsg('You have the latest version.')
      }
    } catch (e:any) {
      setUpdateMsg('Update check failed: ' + e.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <footer className="app-footer">
      © {year} PassGen · Developer: <a href="https://github.com/Jalal-Nasser" target="_blank" rel="noopener noreferrer">JalalNasser</a> · Blog: <a href="https://jalalnasser.com" target="_blank" rel="noopener noreferrer">BlogiFy</a>
      {' '}· <a href="#" onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new Event('open-terms'))}}>Terms</a>
      {' '}· <a href="#" onClick={(e)=>{e.preventDefault(); checkForUpdate()}}>{checking ? 'Checking...' : 'Check for Updates'}</a>
      {' '}· Free: 4 passwords · <a href="#" onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new Event('open-upgrade'))}}>Upgrade to Premium ($3.99/mo)</a>
      {updateMsg && <div style={{marginTop:4, fontSize:13, color:'#4a4'}}>{updateMsg}</div>}
    </footer>
  )
}

export default AppFooter
