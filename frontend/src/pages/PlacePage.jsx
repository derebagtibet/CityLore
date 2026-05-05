import { useState, useEffect } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { placesAPI, reviewsAPI, authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useRoute } from '../context/RouteContext'
import { MapPin, Star, Clock, DollarSign, Globe, Bookmark, BookmarkCheck, Trash2, ArrowLeft, Eye, Navigation, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import PanoramaModal from '../components/PanoramaModal'
import { has360Imagery } from '../utils/place360'
import { useLanguage } from '../i18n/LanguageContext'

const PLACE_FALLBACK_IMAGES = {
  'nysa antik kenti': 'https://commons.wikimedia.org/wiki/Special:FilePath/Nysa_on_the_Maeander,_Turkey_-_52535674903.jpg',
  'tralleis antik kenti': 'https://commons.wikimedia.org/wiki/Special:FilePath/Tralleis_Ancient_City%2C_Aydin%2C_Turkey.jpg',
  'didyma apollon tapınağı': 'https://commons.wikimedia.org/wiki/Special:FilePath/Didyma_Apollon_Temple.jpg',
  'oymaağaç höyüğü (nerik)': 'https://upload.wikimedia.org/wikipedia/commons/6/63/Oymaa%C4%9Fac_H%C3%B6y%C3%BCk_01.jpg',
  'paflagon kaya mezarları': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Boyabat_rock-cut_tomb%2C_built_in_the_7th_century_BC_by_the_Paphlagonians%2C_located_in_the_village_of_Salar_near_Boyabat%2C_Sinop_Province%2C_Turkey_-_52826228162.jpg',
  'paflagon kaya mezarlari': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Boyabat_rock-cut_tomb%2C_built_in_the_7th_century_BC_by_the_Paphlagonians%2C_located_in_the_village_of_Salar_near_Boyabat%2C_Sinop_Province%2C_Turkey_-_52826228162.jpg',
  'asar kale': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Sinop-ruine4.JPG',
  'paşa tabyası': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Sinop_Eastern_Bastion_9152.jpg',
  'pasa tabyasi': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Sinop_Eastern_Bastion_9152.jpg',
  'ardahan kalesi': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Ardahan_kalesi_2011.jpg',
  'kinzi kalesi': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Ardahan_kalesi_2011.jpg',
  'şeytan kalesi': 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Ardahan_%C5%9Feytan_kale.jpg',
  'seytan kalesi': 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Ardahan_%C5%9Feytan_kale.jpg',
  'harmandöven kervansarayı': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/I%C4%9Fd%C4%B1r_han_k%C3%B6y%C3%BC_%28kervansaray%29_-_panoramio.jpg',
  'harmandoven kervansarayi': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/I%C4%9Fd%C4%B1r_han_k%C3%B6y%C3%BC_%28kervansaray%29_-_panoramio.jpg',
  'karakale harabesi': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/%C5%9Eeytan_Kale_-_Satan%27s_Castle.jpg',
  'iğdır soykırım anıt-müzesi': 'https://upload.wikimedia.org/wikipedia/commons/5/56/IgdirGenocideMuseum.jpg',
  'igdir soykirim anit-muzesi': 'https://upload.wikimedia.org/wikipedia/commons/5/56/IgdirGenocideMuseum.jpg',
}

const normalizePlaceName = (value = '') => value.toLocaleLowerCase('tr-TR').trim()

export default function PlacePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { addToRoute, routePlaces } = useRoute()
  const { t, translatePlace } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [place, setPlace] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [panoramaOpen, setPanoramaOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([placesAPI.getOne(id), reviewsAPI.getByPlace(id)])
      .then(([placeRes, reviewsRes]) => {
        setPlace(placeRes.data)
        setReviews(reviewsRes.data)
        if (user) {
          setSaved(user.savedPlaces?.some(savedPlace => (savedPlace?._id || savedPlace) === id))
        }
      })
      .finally(() => setLoading(false))
  }, [id, user])

  useEffect(() => {
    setImageFailed(false)
  }, [id])

  const handleSave = async () => {
    if (!user) { toast.error(t('toast.saveLogin')); return }
    await authAPI.savePlace(id)
    setSaved(!saved)
    toast.success(saved ? t('toast.unsaved') : t('toast.saved'))
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (!reviewForm.comment.trim() || reviewForm.comment.length < 10) {
      toast.error(t('toast.reviewMin'))
      return
    }
    setSubmitting(true)
    try {
      const { data } = await reviewsAPI.create(id, reviewForm)
      setReviews(prev => [data, ...prev])
      setReviewForm({ rating: 5, comment: '' })
      toast.success(t('toast.reviewAdded'))
      const updatedPlace = await placesAPI.getOne(id)
      setPlace(updatedPlace.data)
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteReview = async (reviewId) => {
    try {
      await reviewsAPI.delete(reviewId)
      setReviews(prev => prev.filter(r => r._id !== reviewId))
      const updatedPlace = await placesAPI.getOne(id)
      setPlace(updatedPlace.data)
      toast.success(t('toast.reviewDeleted'))
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.reviewDeleteFailed'))
    }
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="h-64 bg-stone-800 rounded-2xl animate-pulse mb-6" />
      <div className="h-8 bg-stone-800 rounded-xl animate-pulse w-1/2 mb-4" />
      <div className="h-4 bg-stone-800 rounded animate-pulse w-3/4" />
    </div>
  )

  if (!place) return <div className="text-center py-20 text-stone-500">{t('place.notFound')}</div>

  const displayPlace = translatePlace(place)
  const has360 = has360Imagery(place)
  const isInRoute = routePlaces.some(p => p._id === place._id)
  const dbImage = Array.isArray(place.images) ? place.images.find(Boolean) : ''
  const fallbackImage = PLACE_FALLBACK_IMAGES[normalizePlaceName(place.name)]
  const heroImage = !imageFailed ? (dbImage || fallbackImage || '') : ''
  const handleBack = () => {
    const returnMapState = location.state?.returnMapState

    if (returnMapState) {
      navigate('/map', { state: { restoreMap: returnMapState } })
      return
    }

    navigate('/map')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <button onClick={handleBack} className="flex items-center gap-1.5 text-stone-500 hover:text-stone-300 mb-6 transition-colors text-sm">
        <ArrowLeft size={16} /> {t('common.back')}
      </button>

      {/* Hero image */}
      <div className="h-64 md:h-80 bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl flex items-center justify-center mb-6 relative overflow-hidden">
        {heroImage ? (
          <>
            <img src={heroImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-xl" aria-hidden="true" />
            <img src={heroImage} alt={displayPlace.displayName} className="pointer-events-none relative z-10 max-h-full max-w-full object-contain" onError={() => setImageFailed(true)} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-stone-600">
            <ImageIcon size={52} strokeWidth={1.4} />
            <span className="text-sm">{t('place.imageUnavailable') || 'Image not available yet'}</span>
          </div>
        )}
        <div className="pointer-events-auto absolute top-4 right-4 z-20 flex gap-2">
          <button
            onClick={() => has360 && setPanoramaOpen(true)}
            disabled={!has360}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-sm border transition-all text-sm font-medium ${has360 ? 'bg-stone-900/80 border-stone-700 text-amber-400 hover:bg-amber-500 hover:text-stone-950 hover:border-amber-400' : 'bg-stone-900/80 border-stone-800 text-stone-500 cursor-not-allowed'}`}
          >
            <Eye size={15} /> {has360 ? '360 View' : t('place.viewUnavailable')}
          </button>
          
          <button 
            onClick={() => addToRoute(place)}
            disabled={isInRoute}
            className={`p-2.5 rounded-xl backdrop-blur-sm border transition-all ${isInRoute ? 'bg-emerald-500/90 border-emerald-400 text-stone-950' : 'bg-stone-900/80 border-stone-700 text-stone-300 hover:text-emerald-400'}`}
            title={isInRoute ? t('place.inRoute') : t('map.addToRoute')}
          >
            <Navigation size={18} fill={isInRoute ? "currentColor" : "none"} />
          </button>

          <button onClick={handleSave} className={`p-2.5 rounded-xl backdrop-blur-sm border transition-all ${saved ? 'bg-amber-500/90 border-amber-400 text-stone-950' : 'bg-stone-900/80 border-stone-700 text-stone-300 hover:text-amber-400'}`}>
            {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20">{displayPlace.displayCategory || t(`categories.${place.category}`)}</span>
            {place.period && <span className="badge bg-stone-800 text-stone-400 border border-stone-700">{displayPlace.displayPeriod}</span>}
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-stone-100 mb-2">{displayPlace.displayName}</h1>
          <div className="flex items-center gap-1 text-stone-500 text-sm mb-4">
            <MapPin size={14} /> {displayPlace.displayCity} {place.address && `• ${displayPlace.displayAddress}`}
          </div>
          <p className="text-stone-400 leading-relaxed">{displayPlace.displayDescription}</p>
        </div>

        <div className="space-y-3">
          {place.rating > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Star size={16} className="text-amber-400" fill="currentColor" />
                <span className="font-bold text-2xl text-stone-100">{place.rating}</span>
              </div>
              <div className="text-stone-500 text-sm">{place.reviewCount} {t('place.reviews').toLowerCase()}</div>
            </div>
          )}
          {place.entryFee !== undefined && (
            <div className="card p-4">
              <div className="text-stone-500 text-xs mb-1">{t('place.entryFee')}</div>
              <div className="font-semibold text-stone-100">
                {place.entryFee === 0 ? `🆓 ${t('common.free')}` : `₺${place.entryFee}`}
              </div>
            </div>
          )}
          {place.openingHours && (
            <div className="card p-4">
              <div className="flex items-center gap-1.5 text-stone-500 text-xs mb-1"><Clock size={12} /> {t('place.openingHours')}</div>
              <div className="text-stone-300 text-sm">{displayPlace.displayOpeningHours}</div>
            </div>
          )}
          {place.website && (
            <a href={place.website} target="_blank" rel="noopener noreferrer" className="card p-3 flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors text-sm">
              <Globe size={14} /> {t('common.website')}
            </a>
          )}
        </div>
      </div>

      {/* Reviews */}
      <section>
        <h2 className="font-display text-2xl font-bold text-stone-100 mb-6">{t('place.reviews')}</h2>

        {user ? (
          <form onSubmit={handleReviewSubmit} className="card p-5 mb-6">
            <h3 className="font-medium text-stone-200 mb-4">{t('place.writeReview')}</h3>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-stone-500 text-sm">{t('place.yourRating')}</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setReviewForm(f => ({ ...f, rating: n }))}
                  className={`text-2xl transition-transform hover:scale-110 ${n <= reviewForm.rating ? 'text-amber-400' : 'text-stone-700'}`}>★</button>
              ))}
            </div>
            <textarea
              className="input resize-none mb-3"
              rows={3}
              placeholder={t('place.reviewPlaceholder')}
              value={reviewForm.comment}
              onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
            />
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? t('place.sending') : t('place.sendReview')}
            </button>
          </form>
        ) : (
          <div className="card p-5 mb-6 text-center text-stone-500">
            <Link to="/login" state={{ from: location.pathname }} className="text-amber-400 hover:underline">{t('place.loginToReviewStart')}</Link> {t('place.loginToReviewMiddle')} <Link to="/register" state={{ from: location.pathname }} className="text-amber-400 hover:underline">{t('place.registerToReview')}</Link> — {t('place.loginToReviewEnd')}
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="text-center text-stone-600 py-8">{t('place.noReviews')}</div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review._id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-stone-950 font-bold text-sm">
                      {review.user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-stone-200 text-sm">{review.user?.username}</div>
                      <div className="flex">
                        {[1,2,3,4,5].map(n => (
                          <span key={n} className={`text-sm ${n <= review.rating ? 'text-amber-400' : 'text-stone-700'}`}>★</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {(user?._id === review.user?._id || user?.role === 'admin') && (
                    <button onClick={() => handleDeleteReview(review._id)} className="text-stone-600 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="text-stone-400 text-sm leading-relaxed">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Panorama Modal */}
      {panoramaOpen && (
        <PanoramaModal
          place={place}
          onClose={() => setPanoramaOpen(false)}
        />
      )}
    </div>
  )
}
