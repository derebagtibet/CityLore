import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { citiesAPI, placesAPI } from '../services/api'
import { MapPin, Landmark, Star, ArrowRight, Image as ImageIcon } from 'lucide-react'
import { has360Imagery } from '../utils/place360'
import { useLanguage } from '../i18n/LanguageContext'
import { useAuth } from '../context/AuthContext'

const getPlaceImage = (place) => Array.isArray(place.images) ? place.images.find(Boolean) : ''

export default function CityPage() {
  const { t, translateCity, translatePlace } = useLanguage()
  const { user } = useAuth()
  const { id } = useParams()
  const [city, setCity] = useState(null)
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    citiesAPI.getOne(id).then(res => {
      setCity(res.data)
      return placesAPI.getAll({ city: res.data.name, limit: 50 })
    }).then(res => {
      setPlaces(res.data.places)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64 text-stone-500">{t('common.loading')}</div>
  if (!city) return <div className="text-center py-20 text-stone-500">{t('city.notFound')}</div>

  const displayCity = translateCity(city)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-10">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-stone-100 mb-2">{displayCity.displayName}</h1>
        <p className="text-stone-400">{displayCity.displayDescription}</p>
        <div className="flex items-center gap-4 mt-4">
          <span className="flex items-center gap-1 text-stone-500 text-sm"><MapPin size={14} /> {displayCity.displayRegion}</span>
          <span className="flex items-center gap-1 text-amber-400 text-sm"><Landmark size={14} /> {t('city.historicalPlaces', { count: city.placeCount })}</span>
          <Link to={`/map`} className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm">
            {t('place.showOnMap')} <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {places.map(place => {
          const displayPlace = translatePlace(place)
          const placeImage = getPlaceImage(place)
          return (
          <Link key={place._id} to={`/place/${place._id}`} className="card group hover:border-amber-500/30 transition-all">
            <div className="h-36 bg-gradient-to-br from-stone-800 to-stone-900 flex items-center justify-center overflow-hidden">
              {placeImage && (
                <img
                  src={placeImage}
                  alt={displayPlace.displayName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.classList.add('hidden')
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              )}
              <div className={`${placeImage ? 'hidden ' : ''}flex flex-col items-center gap-2 text-stone-600`}>
                <ImageIcon size={32} strokeWidth={1.4} />
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-stone-100 group-hover:text-amber-300 transition-colors">{displayPlace.displayName}</h3>
              <p className="text-stone-500 text-xs mt-1 line-clamp-2">{displayPlace.displayDescription}</p>
              <div className={`mt-3 text-xs ${has360Imagery(place) ? 'text-amber-400' : 'text-stone-600'}`}>
                {has360Imagery(place) ? '360 View' : t('place.viewUnavailable')}
              </div>
              <div className="flex items-center justify-between mt-3">
                {place.rating > 0 && (
                  <span className="flex items-center gap-1 text-amber-400 text-xs">
                    <Star size={11} fill="currentColor" /> {place.rating}
                  </span>
                )}
                {place.period && <span className="text-stone-600 text-xs">{displayPlace.displayPeriod}</span>}
              </div>
            </div>
          </Link>
        )})}
      </div>

      {places.length === 0 && (
        <div className="text-center py-16 text-stone-500">
          <Landmark size={40} className="mx-auto mb-3 opacity-30" />
          <p>{t('city.empty')}</p>
          {user?.role === 'admin' && (
            <Link to="/add-place" className="text-amber-400 hover:underline mt-2 inline-block">{t('city.addFirst')}</Link>
          )}
        </div>
      )}
    </div>
  )
}
