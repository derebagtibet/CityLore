import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { authAPI, placesAPI } from '../services/api'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bookmark, Compass, LogOut, MapPin, Plus, Puzzle, Route, Settings, Target, Trophy, User, Zap } from 'lucide-react'
import Lottie from 'lottie-react'
import toast from 'react-hot-toast'
import explorerGuide from '../assets/animations/explorer-guide.json'
import { useLanguage } from '../i18n/LanguageContext'
import DiscoveryPuzzle, { DISCOVERIES_PER_LEVEL, getDiscoveryLevelTitleKey, getDiscoveryProgress } from '../components/DiscoveryPuzzle'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const { t, translatePlace } = useLanguage()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ username: '', bio: '' })
  const [myPlaces, setMyPlaces] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    Promise.all([
      authAPI.getMe(),
      placesAPI.getAll({ mine: true, limit: 100 }),
    ]).then(([profileRes, placesRes]) => {
      setProfile(profileRes.data)
      setForm({ username: profileRes.data.username, bio: profileRes.data.bio || '' })
      setMyPlaces(placesRes.data.places || [])
    })
  }, [user])

  const handleUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authAPI.updateProfile(form)
      toast.success(t('profile.updated'))
      setEditing(false)
      const res = await authAPI.getMe()
      setProfile(res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!profile) return <div className="flex items-center justify-center h-64 text-stone-500">{t('common.loading')}</div>

  const savedPlaces = profile.savedPlaces || []
  const savedCount = savedPlaces.length
  const isAdmin = profile.role === 'admin'
  const myPlacesCount = myPlaces.length
  const {
    completedLevels,
    currentLevel,
    progressForDisplay,
    progressPercent,
    remaining,
  } = getDiscoveryProgress(savedCount)
  const levelTitle = t(getDiscoveryLevelTitleKey(currentLevel))
  const dailyMissionTarget = 2
  const dailyMissionProgress = savedCount > 0 ? savedCount % (dailyMissionTarget + 1) : 0
  const dailyMissionDisplayProgress = Math.min(dailyMissionProgress, dailyMissionTarget)
  const dailyMissionCompleted = dailyMissionDisplayProgress >= dailyMissionTarget
  const dailyMissionPercent = Math.min((dailyMissionDisplayProgress / dailyMissionTarget) * 100, 100)
  const initial = profile.username?.[0]?.toUpperCase() || 'C'
  const profileStats = [
    { label: t('profile.cardDiscoveries'), value: savedCount, icon: MapPin },
    { label: t('profile.cardCities'), value: savedCount, icon: Compass },
    { label: t('profile.cardComplete'), value: `${Math.round(progressPercent)}%`, icon: Puzzle },
  ]
  const statCards = [
    { label: t('profile.statsSaved'), value: savedCount, hint: t('profile.statsSavedHint'), icon: Bookmark },
    { label: t('profile.statsCities'), value: 81, hint: t('profile.statsCitiesHint'), icon: MapPin },
    { label: t('profile.statsRoutes'), value: savedCount, hint: t('profile.statsRoutesHint'), icon: Route },
  ]
  if (isAdmin) {
    statCards.push({ label: t('profile.statsAdded'), value: myPlacesCount, hint: t('profile.statsAddedHint'), icon: Plus })
  }
  const actionCards = [
    { label: t('profile.openMap'), text: t('profile.openMapText'), to: '/map', icon: Compass },
    { label: t('profile.liveEvents'), text: t('profile.liveEventsText'), to: '/map', icon: Zap },
    { label: t('profile.createRoute'), text: t('profile.createRouteText'), to: '/map', icon: Route },
  ]
  if (isAdmin) {
    actionCards.splice(2, 0, { label: t('profile.addPlace'), text: t('profile.addPlaceText'), to: '/add-place', icon: Plus })
  }
  return (
    <div className="relative min-h-[calc(100vh-80px)] overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(hsl(var(--gold-line)/0.45)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--gold-line)/0.35)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="profile-gold-glow pointer-events-none absolute left-1/2 top-0 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-gold-bright/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl animate-fade-in">
        <header className="profile-fade-up relative overflow-hidden rounded-lg border border-gold/25 bg-panel/80 px-6 py-8 shadow-card-lux backdrop-blur sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--gold-bright)/0.22),transparent_34%),radial-gradient(circle_at_76%_0%,hsl(var(--ember-red)/0.12),transparent_30%)]" />
          <div className="relative z-10 max-w-3xl">
            <p className="section-label mb-3">{t('profile.dashboardEyebrow')}</p>
            <h1 className="font-display text-4xl font-bold text-stone-100 md:text-5xl">{t('profile.dashboardTitle')}</h1>
            <p className="mt-3 text-sm leading-6 text-stone-400 sm:text-base">{t('profile.dashboardSubtitle')}</p>
          </div>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-stretch">
          <aside className="profile-fade-up lux-card h-auto self-start p-6 text-center transition duration-300 hover:scale-[1.01] hover:shadow-[0_0_36px_hsl(var(--gold-bright)/0.22),0_20px_60px_hsl(var(--shadow-black)/0.65)] [animation-delay:90ms] lg:h-full lg:self-stretch">
            <div className="relative z-10 flex h-full flex-col">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-gold/45 bg-gradient-to-br from-gold-bright to-gold-deep text-4xl font-bold text-bg-deep shadow-gold-bloom">
                {initial}
              </div>
              <h2 className="font-display text-2xl font-bold text-stone-100">{profile.username}</h2>
              <div className="mt-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-bright">
                {t('profile.levelBadge', { level: currentLevel, title: levelTitle })}
              </div>
              {completedLevels > 0 && (
                <div className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-bg-black/70 px-3 py-1 text-[11px] font-bold text-gold-bright shadow-[0_0_18px_hsl(var(--gold-bright)/0.14)]">
                  <Trophy size={13} />
                  {t('profile.discoveryPuzzleNewBadge')}
                </div>
              )}
              <p className="mt-1 text-sm text-stone-500">{profile.email}</p>
              <p className="mt-3 text-sm font-medium text-stone-300">
                {t('profile.completedDiscoveries', { count: savedCount })}
              </p>
              <p className="mt-4 min-h-[48px] text-sm leading-6 text-stone-400">
                {profile.bio || t('profile.noBio')}
              </p>

              <div className="mt-5 space-y-4 border-y border-gold/20 py-4">
                <div className="grid grid-cols-2 gap-2">
                  {profileStats.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-lg border border-gold/20 bg-bg-black/55 p-2.5 text-left shadow-[0_0_18px_hsl(var(--gold-bright)/0.08)]">
                      <div className="flex items-center gap-2 text-gold-bright">
                        <Icon size={14} />
                        <span className="text-sm font-bold">{value}</span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-gold/65">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="text-left">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-gold/75">
                    <span>{t('profile.levelProgressTitle', { level: currentLevel })}</span>
                    <span>{t('profile.levelProgressCount', { count: progressForDisplay, total: DISCOVERIES_PER_LEVEL })}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-black">
                    <div className="discovery-progress-fill h-full rounded-full bg-gradient-to-r from-gold-deep via-gold-bright to-gold-soft shadow-[0_0_16px_hsl(var(--gold-bright)/0.45)]" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-stone-500">
                    {progressForDisplay === DISCOVERIES_PER_LEVEL
                      ? t('profile.collectionCompleted')
                      : t('profile.nextLevelRemaining', { count: remaining })}
                  </p>
                </div>

                <div className="rounded-lg border border-gold/20 bg-gold/10 p-3 text-left shadow-[0_0_18px_hsl(var(--gold-bright)/0.08)]">
                  <p className="text-xs font-semibold text-gold-bright">{t('profile.nextUnlockLabel')}</p>
                  <p className="mt-1 text-sm text-stone-300">
                    {progressForDisplay === DISCOVERIES_PER_LEVEL
                      ? t('profile.discoveryPuzzleNextCollectionCta')
                      : t('profile.nextLevelRemaining', { count: remaining })}
                  </p>
                </div>

                <div className={`group relative overflow-hidden rounded-xl border p-4 text-left transition duration-300 hover:-translate-y-0.5 ${dailyMissionCompleted ? 'border-gold-bright/50 bg-gold/10 shadow-gold-bloom' : 'border-gold/25 bg-bg-black/60 shadow-[0_0_22px_hsl(var(--gold-bright)/0.12)] hover:border-gold/45'}`}>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,hsl(var(--gold-bright)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--gold)/0.08),transparent_45%)]" />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold/75">{t('profile.dailyMissionTitle')}</p>
                        <h3 className="mt-2 font-display text-xl font-semibold text-stone-100">
                          {dailyMissionCompleted ? t('profile.dailyMissionComplete') : t('profile.dailyMissionTarget')}
                        </h3>
                      </div>
                      <div className="rounded-lg border border-gold/30 bg-bg-black/70 p-2 text-gold-bright">
                        <Target size={18} />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-gold/75">
                      <span>{dailyMissionDisplayProgress}/{dailyMissionTarget}</span>
                      <span>{t('profile.dailyMissionReward')}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-black">
                      <div className="discovery-progress-fill h-full rounded-full bg-gradient-to-r from-gold-deep via-gold-bright to-gold-soft" style={{ width: `${dailyMissionPercent}%` }} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-stone-400">
                      {dailyMissionCompleted ? t('profile.dailyMissionRewardGained') : t('profile.dailyMissionHint')}
                    </p>
                    <Link to="/map?tab=places" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-gold-bright to-gold-deep px-3 py-2.5 text-xs font-bold text-bg-deep transition duration-300 hover:scale-[1.02]">
                      <MapPin size={14} />
                      {t('profile.dailyMissionCta')}
                    </Link>
                  </div>
                </div>

                <div className="rounded-lg border border-gold/15 bg-bg-black/50 p-3 text-left">
                  <p className="text-xs font-semibold text-gold-bright">{t('profile.dailySuggestionLabel')}</p>
                  <p className="mt-1 text-sm text-stone-300">{t('profile.dailySuggestionText')}</p>
                </div>

                <div className="relative overflow-hidden rounded-lg border border-gold/20 bg-bg-black/55 p-3 text-left shadow-[0_0_18px_hsl(var(--gold-bright)/0.08)]">
                  <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(hsl(var(--gold-line)/0.55)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--gold-line)/0.45)_1px,transparent_1px)] [background-size:18px_18px]" />
                  <div className="relative z-10">
                    <p className="text-xs font-semibold text-gold-bright">{t('profile.routeGuideTitle')}</p>
                    <p className="mt-1 text-xs leading-5 text-stone-400">{t('profile.routeGuideSubtitle')}</p>
                    <div className="relative mt-3 h-28 overflow-hidden rounded-lg border border-gold/15 bg-panel/65">
                      <svg viewBox="0 0 260 112" className="h-full w-full" aria-hidden="true">
                        <defs>
                          <radialGradient id="routeGlow" cx="50%" cy="50%" r="60%">
                            <stop offset="0%" stopColor="hsl(var(--gold-bright))" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="hsl(var(--gold-bright))" stopOpacity="0" />
                          </radialGradient>
                        </defs>
                        <rect width="260" height="112" fill="url(#routeGlow)" opacity="0.45" />
                        <path d="M24 82 C62 34 86 92 118 54 S168 18 206 48 S228 76 238 30" fill="none" stroke="hsl(var(--gold-line) / 0.22)" strokeWidth="6" strokeLinecap="round" />
                        <path className="animate-drift-dash" d="M24 82 C62 34 86 92 118 54 S168 18 206 48 S228 76 238 30" fill="none" stroke="hsl(var(--gold-bright))" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14 8" />
                        {[
                          [24, 82, '0ms'],
                          [118, 54, '180ms'],
                          [206, 48, '360ms'],
                          [238, 30, '540ms'],
                        ].map(([cx, cy, delay]) => (
                          <g key={`${cx}-${cy}`} className="node-pulse" style={{ '--node-duration': '2.2s', animationDelay: delay }}>
                            <circle cx={cx} cy={cy} r="6" fill="hsl(var(--bg-black))" stroke="hsl(var(--gold-bright))" strokeWidth="2" />
                            <circle cx={cx} cy={cy} r="2.5" fill="hsl(var(--gold-bright))" />
                          </g>
                        ))}
                      </svg>
                      <div className="route-guide-float absolute left-[45%] top-[28%] rounded-full border border-gold/30 bg-bg-black/85 p-2 text-gold-bright shadow-gold-bloom">
                        <Compass size={16} />
                      </div>
                      <div className="live-dot absolute bottom-5 left-6 h-3 w-3 rounded-full bg-gold-bright shadow-[0_0_18px_hsl(var(--gold-bright)/0.8)]" />
                    </div>
                    <Link to="/map?tab=places" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold text-gold-bright transition duration-300 hover:border-gold-bright hover:bg-gold/15">
                      <Route size={14} />
                      {t('profile.routeGuideCta')}
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold/75">
                <User size={14} />
                {profile.role === 'admin' ? t('common.admin') : t('common.member')}
              </div>
              <button onClick={() => setEditing(!editing)} className="btn-secondary mt-5 flex w-full items-center justify-center gap-2 text-sm">
                <Settings size={14} /> {t('profile.editProfile')}
              </button>
              <button onClick={() => { logout(); navigate('/') }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-red-400 transition-colors hover:text-red-300">
                <LogOut size={14} /> {t('profile.logout')}
              </button>

              <div className="relative mt-5 flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-xl border border-gold/25 bg-bg-black/65 p-4 pb-4 text-left shadow-[inset_0_0_0_1px_hsl(var(--gold-bright)/0.08),0_0_22px_hsl(var(--gold-bright)/0.12)] transition duration-300 hover:-translate-y-0.5 hover:border-gold/45 sm:min-h-[235px]">
                <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(hsl(var(--gold-line)/0.45)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--gold-line)/0.35)_1px,transparent_1px)] [background-size:18px_18px]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_78%,hsl(var(--gold-bright)/0.18),transparent_38%),linear-gradient(145deg,transparent,hsl(var(--bg-black)/0.64))]" />
                <svg viewBox="0 0 160 116" className="pointer-events-none absolute bottom-0 right-0 h-28 w-40 text-gold-bright opacity-40" aria-hidden="true">
                  <path d="M32 86 C58 52 82 92 106 56 S132 36 148 52" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="4 7" opacity="0.5" />
                  {[ [42, 76], [96, 62], [136, 48] ].map(([cx, cy]) => (
                    <g key={`${cx}-${cy}`}>
                      <circle cx={cx} cy={cy} r="7" fill="hsl(var(--bg-black))" stroke="currentColor" strokeWidth="1.4" opacity="0.85" />
                      <circle cx={cx} cy={cy} r="2" fill="currentColor" />
                    </g>
                  ))}
                </svg>
                <div className="relative z-10 flex h-full flex-1 flex-col justify-between">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-gold/75">
                      <Compass size={13} />
                      {t('profile.explorerGuideLabel')}
                    </div>
                    <h3 className="font-display text-base font-semibold leading-snug text-stone-100">
                      {t('profile.explorerGuideTitle')}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-stone-500">
                      {t('profile.explorerGuideSubtitle')}
                    </p>
                  </div>
                  <Lottie
                    animationData={explorerGuide}
                    loop
                    autoplay
                    style={{
                      width: 166,
                      margin: '18px auto 0',
                      opacity: 0.9,
                      filter: 'brightness(0.9) contrast(1.05)',
                      transform: 'scale(1.06)',
                      transformOrigin: 'center bottom',
                    }}
                  />
                </div>
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map(({ label, value, hint, icon: Icon }, index) => (
                <article key={label} className="profile-fade-up rounded-lg border border-gold/25 bg-panel/85 p-5 shadow-card-lux" style={{ animationDelay: `${140 + index * 70}ms` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold/65">{label}</p>
                      <p className="profile-count-in mt-3 font-display text-4xl font-bold text-gold-bright" style={{ animationDelay: `${260 + index * 90}ms` }}>{value}</p>
                    </div>
                    <div className="rounded-lg border border-gold/25 bg-gold/10 p-2 text-gold-bright">
                      <Icon size={20} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-stone-500">{hint}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {actionCards.map(({ label, text, to, icon: Icon }, index) => (
                <Link key={label} to={to} className="profile-fade-up group relative overflow-hidden rounded-lg border border-gold/25 bg-bg-black/70 p-5 transition duration-300 hover:-translate-y-1 hover:border-gold/60 hover:bg-panel/95 hover:shadow-gold-bloom" style={{ animationDelay: `${240 + index * 70}ms` }}>
                  <div className="absolute inset-x-5 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-gold-bright to-transparent transition-transform duration-300 group-hover:scale-x-100" />
                  <div className="mb-5 inline-flex rounded-lg border border-gold/25 bg-gold/10 p-2 text-gold-bright transition duration-300 group-hover:scale-110">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-stone-100">{label}</h3>
                  <p className="mt-2 min-h-[44px] text-sm leading-6 text-stone-500">{text}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold-bright">
                    {t('profile.actionOpen')} <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </section>

            {isAdmin && (
            <section className="profile-fade-up rounded-lg border border-gold/25 bg-panel/85 p-5 shadow-card-lux">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="section-label mb-2">{t('profile.myAddedEyebrow')}</p>
                  <h3 className="font-display text-2xl font-semibold text-stone-100">{t('profile.myAddedPlaces')}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{t('profile.myAddedText')}</p>
                </div>
                {isAdmin && (
                  <Link to="/add-place" className="btn-secondary inline-flex items-center gap-2 text-sm">
                    <Plus size={14} />
                    {t('profile.addPlace')}
                  </Link>
                )}
              </div>

              {myPlaces.length === 0 ? (
                <div className="rounded-lg border border-gold/15 bg-bg-black/55 p-5 text-sm text-stone-500">
                  {t('profile.noAddedPlaces')}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {myPlaces.map((place) => {
                    const displayPlace = translatePlace(place)

                    return (
                      <Link
                        key={place._id}
                        to={`/place/${place._id}`}
                        className="group rounded-lg border border-gold/15 bg-bg-black/55 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-gold/45 hover:bg-bg-black/80"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-semibold text-stone-100 group-hover:text-gold-bright">{displayPlace.displayName}</h4>
                            <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                              <MapPin size={11} />
                              {displayPlace.displayCity || t('profile.unknownCity')}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-bright">
                            {place.visibility === 'public' ? t('profile.publicPlace') : t('profile.privatePlace')}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-stone-500">{displayPlace.displayDescription}</p>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
            )}

            {editing && (
              <form onSubmit={handleUpdate} className="profile-fade-up rounded-lg border border-gold/25 bg-panel/85 p-5 shadow-card-lux space-y-4">
                <h3 className="font-display text-xl font-semibold text-gold-bright">{t('profile.editProfile')}</h3>
                <div>
                  <label className="block text-stone-400 text-sm mb-1.5">{t('auth.username')}</label>
                  <input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-stone-400 text-sm mb-1.5">{t('profile.bio')}</label>
                  <textarea className="input resize-none" rows={3} placeholder={t('profile.bioPlaceholder')} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={loading} className="btn-primary text-sm disabled:opacity-50">
                    {loading ? t('profile.saving') : t('common.save')}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">{t('common.cancel')}</button>
                </div>
              </form>
            )}

            <DiscoveryPuzzle savedPlaces={savedPlaces} />
          </main>
        </div>
      </div>
    </div>
  )
}
