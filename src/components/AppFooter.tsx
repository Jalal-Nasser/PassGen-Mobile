function AppFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="app-footer">
      © {year} PassGen · Developer: <a href="https://github.com/Jalal-Nasser" target="_blank" rel="noopener noreferrer">JalalNasser</a> · Visit My IT Blog: <a href="https://jalalnasser.com" target="_blank" rel="noopener noreferrer">BlogiFy</a>
      {' '}· <a href="#" onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new Event('open-terms'))}}>Terms</a>
      {' '}· Free: 4 passwords · Premium $3.99/mo
    </footer>
  )
}

export default AppFooter
