import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { LogOut, Menu, Plus, Shield, User, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useLanguage } from '../i18n/LanguageContext'
import { MapGlyph, MuseumIcon } from './visuals/Ornaments'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { isConnected } = useSocket()
  const { language, t, toggleLanguage } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }
  const handleMapClick = () => {
    if (location.pathname === '/map') {
      navigate('/map', { state: { resetMap: true } })
      return
    }

    navigate('/map')
  }
  const isActive = (path) => location.pathname === path
  const nextLanguageLabel = language === 'tr' ? 'EN' : 'TR'

  return (
    <nav className="sticky top-0 z-50 h-[72px] border-b border-gold/15 bg-gradient-to-b from-bg-black via-bg-black/92 to-bg-black/55 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1500px] items-center justify-between px-4 sm:px-8 lg:px-16">
        <Link to="/" className="flex items-center gap-3 text-gold-bright">
          <MuseumIcon className="h-7 w-7 text-gold" />
          <span className="font-display text-[22px] font-bold">CityLore</span>
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          <button
            type="button"
            onClick={handleMapClick}
            className={`inline-flex min-w-[132px] items-center justify-center gap-2.5 rounded-xl border px-6 py-3 text-base font-bold tracking-wide transition ${
              isActive('/map')
                ? 'border-gold bg-gold-deep/65 text-gold-bright shadow-[inset_0_0_16px_hsl(var(--gold-bright)_/_0.24),0_0_22px_hsl(var(--gold)_/_0.18)]'
                : 'border-gold/60 bg-gold-deep/45 text-gold-bright shadow-[inset_0_0_14px_hsl(var(--gold-bright)_/_0.22),0_0_18px_hsl(var(--gold)_/_0.14)] hover:border-gold hover:bg-gold-deep/55'
            }`}
          >
            <MapGlyph className="h-5 w-5" />
            {t('nav.map')}
          </button>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="inline-flex items-center gap-2 rounded-full bg-gold/8 px-3 py-2 text-xs font-semibold text-gold/80">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-lime-400 shadow-[0_0_12px_rgb(163_230_53_/_0.9)]' : 'bg-gold-deep'} live-dot`} />
            {isConnected ? t('nav.connected') : t('nav.disconnected')}
          </div>

          {user?.role === 'admin' && (
            <>
              <Link to="/add-place" className="rounded-lg border border-gold/25 px-3 py-2 text-sm text-gold-bright/80 transition hover:border-gold/60">
                <Plus size={15} />
              </Link>
              <Link to="/admin" className="rounded-lg border border-gold/25 px-3 py-2 text-sm text-gold-bright/80 transition hover:border-gold/60">
                <Shield size={15} />
              </Link>
            </>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/profile" className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-bg-black/80 px-3 py-2 text-sm text-gold-bright">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gold/45 font-bold text-xs">
                  {user.username?.[0]?.toUpperCase()}
                </span>
                <span className="max-w-[90px] truncate">{user.username}</span>
              </Link>
              <button onClick={handleLogout} className="rounded-lg border border-gold/20 p-2 text-gold/70 transition hover:border-ember hover:text-ember">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="rounded-lg border border-gold/45 bg-bg-black/40 px-5 py-2 text-sm font-semibold text-gold-bright transition hover:border-gold">
                {t('nav.login')}
              </Link>
              <Link to="/register" className="rounded-lg bg-ember px-5 py-2 text-sm font-semibold text-gold-bright shadow-[0_0_20px_hsl(var(--ember-red)_/_0.4)] transition hover:shadow-[0_0_28px_hsl(var(--ember-red)_/_0.55)]">
                {t('nav.register')}
              </Link>
            </>
          )}

          <button onClick={toggleLanguage} className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-bg-black/60 px-3 py-2 text-sm font-bold text-gold-bright">
            {nextLanguageLabel}
          </button>
        </div>

        <button className="md:hidden rounded-lg border border-gold/25 p-2 text-gold-bright" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gold/15 bg-bg-black px-4 py-3">
          <button
            type="button"
            onClick={() => { handleMapClick(); setMenuOpen(false) }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold/50 bg-gold-deep/45 px-4 py-3 text-base font-bold text-gold-bright shadow-[inset_0_0_14px_hsl(var(--gold-bright)_/_0.2)] hover:bg-gold/10"
          >
            <MapGlyph className="h-5 w-5" /> {t('nav.map')}
          </button>
          {user?.role === 'admin' && <Link to="/add-place" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-gold-bright hover:bg-gold/10"><Plus size={16} /> {t('nav.addPlace')}</Link>}
          {user?.role === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-gold-bright hover:bg-gold/10"><Shield size={16} /> {t('common.admin')}</Link>}
          {user ? (
            <>
              <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-gold-bright hover:bg-gold/10"><User size={16} /> {t('nav.profile')}</Link>
              <button onClick={() => { handleLogout(); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-ember hover:bg-gold/10"><LogOut size={16} /> {t('nav.logout')}</button>
            </>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-secondary text-center text-sm">{t('nav.login')}</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary text-center text-sm">{t('nav.register')}</Link>
            </div>
          )}
          <button onClick={toggleLanguage} className="mt-2 flex w-full items-center justify-center rounded-lg border border-gold/35 bg-bg-black/60 px-3 py-2 text-sm font-bold text-gold-bright">
            {nextLanguageLabel}
          </button>
        </div>
      )}
    </nav>
  )
}
