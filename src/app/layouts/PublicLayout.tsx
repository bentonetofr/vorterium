import { Outlet } from 'react-router-dom'
import './PublicLayout.css'

export function PublicLayout() {
  return (
    <div className="public-layout">
      <div className="public-layout__bg" aria-hidden="true" />
      <div className="public-layout__grain" aria-hidden="true" />
      <div className="public-layout__particles" aria-hidden="true" />
      <main className="public-layout__main">
        <Outlet />
      </main>
      <footer className="public-layout__footer">
        © Era Atual · Campaign Lab
      </footer>
    </div>
  )
}
