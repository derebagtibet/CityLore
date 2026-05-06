import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { placesAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { FileText, Landmark, Map, MapPin, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const categories = ['historical', 'museum', 'mosque', 'castle', 'ruins', 'monument', 'cultural', 'other']

export default function AddPlacePage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', description: '', category: 'cultural', city: '',
    lat: '', lng: '', address: '', period: '', entryFee: 0,
    openingHours: '', website: '', images: '',
    panoramaUrl: '', panoramaxImageId: '', streetViewUrl: '',
    streetViewPanoId: '', streetViewHeading: '', streetViewPitch: '', streetViewFov: '', streetViewRadius: '',
  })
  const [loading, setLoading] = useState(false)

  if (!user) { navigate('/login'); return null }
  if (user.role !== 'admin') { navigate('/map'); return null }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const lat = Number(form.lat)
    const lng = Number(form.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { toast.error(t('toast.coordinatesRequired')); return }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { toast.error(t('toast.coordinatesRequired')); return }
    setLoading(true)
    try {
      const payload = {
        ...form,
        lat,
        lng,
        images: form.images ? form.images.split('\n').map(url => url.trim()).filter(Boolean) : [],
        panoramaUrl: form.panoramaUrl.trim(),
        panoramaxImageId: form.panoramaxImageId.trim(),
        streetViewUrl: form.streetViewUrl.trim(),
        streetView: {
          panoId: form.streetViewPanoId.trim(),
          heading: form.streetViewHeading,
          pitch: form.streetViewPitch,
          fov: form.streetViewFov,
          radius: form.streetViewRadius,
        },
      }
      const { data } = await placesAPI.create(payload)
      toast.success(t('addPlace.added'))
      navigate('/map', {
        state: {
          restoreMap: {
            center: [lat, lng],
            zoom: 15,
            cityName: form.city,
            selectedCategory: payload.category || 'cultural',
            searchTerm: form.name,
            showPlaces: true,
            showEvents: false,
          },
        },
      })
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.error'))
    } finally {
      setLoading(false)
    }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const sectionClass = 'relative overflow-hidden rounded-lg border border-gold/30 bg-panel/90 p-5 shadow-card-lux before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_0%,hsl(var(--gold-bright)/0.12),transparent_32%)]'
  const fieldIconClass = 'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gold/55'
  const iconInputClass = 'input pl-10'
  const previewName = form.name || t('addPlace.namePlaceholder')
  const previewDescription = form.description || t('preview.noDescription')
  const previewCity = form.city || t('addPlace.cityPlaceholder')
  const previewPeriod = form.period || t('preview.period')

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 animate-fade-in">
      <div className="mb-8">
        <p className="section-label mb-3">CityLore Atlas</p>
        <h1 className="font-display text-4xl font-bold text-stone-100 md:text-5xl">{t('addPlace.pageTitle')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400 sm:text-base">
          {t('addPlace.pageSubtitle')}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)] lg:items-start">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className={`${sectionClass} space-y-4`}>
            <h3 className="relative font-display text-xl font-semibold text-gold-bright">{t('addPlace.basic')}</h3>
            <div>
              <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.name')}</label>
              <div className="relative">
                <MapPin className={fieldIconClass} size={17} />
                <input className={iconInputClass} placeholder={t('addPlace.namePlaceholder')} value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.description')}</label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-3 text-gold/55" size={17} />
                <textarea className={`${iconInputClass} resize-none`} rows={4} placeholder={t('addPlace.descriptionPlaceholder')} value={form.description} onChange={e => set('description', e.target.value)} required minLength={20} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-stone-400 text-sm mb-1.5">{t('common.category')} *</label>
                <div className="relative">
                  <Landmark className={fieldIconClass} size={17} />
                  <select className={iconInputClass} value={form.category} onChange={e => set('category', e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.period')}</label>
                <input className="input" placeholder="Ottoman, Byzantine, Roman..." value={form.period} onChange={e => set('period', e.target.value)} />
              </div>
            </div>
          </div>

          <div className={`${sectionClass} space-y-4`}>
            <h3 className="relative font-display text-xl font-semibold text-gold-bright">{t('addPlace.location')}</h3>
            <div>
              <label className="block text-stone-400 text-sm mb-1.5">{t('common.city')} *</label>
              <div className="relative">
                <Map className={fieldIconClass} size={17} />
                <input className={iconInputClass} placeholder={t('addPlace.cityPlaceholder')} value={form.city} onChange={e => set('city', e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.address')}</label>
              <div className="relative">
                <Map className={fieldIconClass} size={17} />
                <input className={iconInputClass} placeholder={t('addPlace.addressPlaceholder')} value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.latitude')}</label>
                <input className="input" placeholder="41.0086" type="number" step="any" value={form.lat} onChange={e => set('lat', e.target.value)} required />
              </div>
              <div>
                <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.longitude')}</label>
                <input className="input" placeholder="28.9800" type="number" step="any" value={form.lng} onChange={e => set('lng', e.target.value)} required />
              </div>
            </div>
            <p className="text-stone-600 text-xs flex items-center gap-1">
              <MapPin size={11} /> {t('addPlace.coordsHint')}
            </p>
          </div>

          <div className={`${sectionClass} space-y-4`}>
            <h3 className="relative font-display text-xl font-semibold text-gold-bright">{t('addPlace.details')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.entryFee')}</label>
              <input className="input" type="number" min={0} placeholder={t('addPlace.entryFeePlaceholder')} value={form.entryFee} onChange={e => set('entryFee', e.target.value)} />
            </div>
            <div>
              <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.openingHours')}</label>
              <input className="input" placeholder="09:00 - 18:00" value={form.openingHours} onChange={e => set('openingHours', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-stone-400 text-sm mb-1.5">{t('common.website')}</label>
            <input className="input" type="url" placeholder="https://..." value={form.website} onChange={e => set('website', e.target.value)} />
          </div>
          <div>
            <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.imageUrls')}</label>
            <textarea className="input resize-none font-mono text-xs" rows={3} placeholder="https://upload.wikimedia.org/..." value={form.images} onChange={e => set('images', e.target.value)} />
          </div>
        </div>

        <div className={`${sectionClass} space-y-4`}>
          <h3 className="relative font-display text-xl font-semibold text-gold-bright">{t('addPlace.streetViewTitle')}</h3>
          <p className="text-stone-500 text-xs leading-relaxed">
            {t('addPlace.streetViewHelp')}
          </p>
          <div>
            <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.panoramaxImageId')}</label>
            <input className="input font-mono text-xs" placeholder={t('addPlace.panoramaxImageIdPlaceholder')} value={form.panoramaxImageId} onChange={e => set('panoramaxImageId', e.target.value)} />
          </div>
          <div>
            <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.panoramaUrl')}</label>
            <input className="input" type="url" placeholder={t('addPlace.panoramaUrlPlaceholder')} value={form.panoramaUrl} onChange={e => set('panoramaUrl', e.target.value)} />
          </div>
          <div>
            <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.streetLevelViewerUrl')}</label>
            <input className="input" type="url" placeholder={t('addPlace.urlPlaceholder')} value={form.streetViewUrl} onChange={e => set('streetViewUrl', e.target.value)} />
          </div>
          <div className="border-t border-stone-800 pt-4 space-y-4">
            <p className="text-stone-500 text-xs leading-relaxed">
              {t('addPlace.googleCameraHelp')}
            </p>
            <div>
              <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.googlePanoramaId')}</label>
              <input className="input font-mono text-xs" placeholder={t('addPlace.googlePanoramaIdPlaceholder')} value={form.streetViewPanoId} onChange={e => set('streetViewPanoId', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.heading')}</label>
                <input className="input" type="number" step="any" placeholder={t('addPlace.autoPlaceholder')} value={form.streetViewHeading} onChange={e => set('streetViewHeading', e.target.value)} />
              </div>
              <div>
                <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.pitch')}</label>
                <input className="input" type="number" step="any" placeholder={t('addPlace.autoPlaceholder')} value={form.streetViewPitch} onChange={e => set('streetViewPitch', e.target.value)} />
              </div>
              <div>
                <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.fov')}</label>
                <input className="input" type="number" min={10} max={100} placeholder="90" value={form.streetViewFov} onChange={e => set('streetViewFov', e.target.value)} />
              </div>
              <div>
                <label className="block text-stone-400 text-sm mb-1.5">{t('addPlace.radius')}</label>
                <input className="input" type="number" min={0} placeholder="500" value={form.streetViewRadius} onChange={e => set('streetViewRadius', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary hero-cta w-full py-3.5 text-base tracking-wide disabled:opacity-50 disabled:hover:transform-none">
          {loading ? t('addPlace.adding') : t('addPlace.submit')}
        </button>
      </form>

        <aside className="lg:sticky lg:top-24">
          <div className="lux-card p-5">
            <div className="relative z-10">
              <div className="mb-5 flex items-center justify-between">
                <span className="hero-badge mb-0">
                  <Sparkles size={14} />
                  {t('preview.title')}
                </span>
                <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-bright">
                  {t(`categories.${form.category}`)}
                </span>
              </div>

              <div className="relative mb-5 h-44 overflow-hidden rounded-lg border border-gold/25 bg-bg-black">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,hsl(var(--gold-bright)/0.28),transparent_28%),linear-gradient(140deg,hsl(var(--bg-black)),hsl(var(--vellum)),hsl(var(--bg-panel)))]" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-black to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2 text-sm font-medium text-gold-bright">
                  <MapPin size={16} />
                  {previewCity}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="card-title-gold text-3xl leading-tight">{previewName}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="badge border border-gold/25 bg-gold/10 text-gold-bright">{previewPeriod}</span>
                    <span className="badge border border-gold/25 bg-bg-black/70 text-gold/80">{previewCity}</span>
                  </div>
                </div>

                <p className="min-h-[96px] text-sm leading-6 text-stone-300">
                  {previewDescription}
                </p>

                <div className="grid grid-cols-2 gap-3 border-t border-gold/20 pt-4 text-xs">
                  <div className="rounded-lg border border-gold/20 bg-bg-black/60 p-3">
                    <p className="text-stone-500">{t('preview.category')}</p>
                    <p className="mt-1 font-semibold text-gold-bright">{t(`categories.${form.category}`)}</p>
                  </div>
                  <div className="rounded-lg border border-gold/20 bg-bg-black/60 p-3">
                    <p className="text-stone-500">{t('preview.period')}</p>
                    <p className="mt-1 font-semibold text-gold-bright">{previewPeriod}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
