import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { placesAPI, eventsAPI } from '../services/api'
import { Trash2, Shield, MapPin, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../i18n/LanguageContext'

const ADMIN_PLACE_LIST_LIMIT = 1000

export default function AdminPage() {
  const { user } = useAuth()
  const { t, translatePlace, translateEvent } = useLanguage()
  const navigate = useNavigate()
  const [places, setPlaces] = useState([])
  const [totalPlaces, setTotalPlaces] = useState(0)
  const [events, setEvents] = useState([])
  const [tab, setTab] = useState('places')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (user.role !== 'admin') { navigate('/'); return }
    placesAPI.getAll({ limit: ADMIN_PLACE_LIST_LIMIT }).then(res => {
      const fetchedPlaces = res.data.places || []
      setPlaces(fetchedPlaces)
      setTotalPlaces(res.data.total ?? fetchedPlaces.length)
    })
    eventsAPI.getAll({}).then(res => setEvents(res.data))
  }, [user])

  const deletePlace = async (id) => {
    await placesAPI.delete(id)
    setPlaces(prev => prev.filter(p => p._id !== id))
    setTotalPlaces(prev => Math.max(prev - 1, 0))
    toast.success(t('admin.placeDeleted'))
  }

  const deleteEvent = async (id) => {
    await eventsAPI.delete(id)
    setEvents(prev => prev.filter(e => e._id !== id))
    toast.success(t('admin.eventDeleted'))
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-stone-950" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-100">{t('admin.title')}</h1>
          <p className="text-stone-500 text-sm">{t('admin.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: t('admin.totalPlaces'), value: totalPlaces, icon: MapPin, color: 'amber' },
          { label: t('admin.liveEvents'), value: events.length, icon: Zap, color: 'emerald' },
          { label: t('admin.activeUsers'), value: '—', icon: Shield, color: 'blue' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <Icon size={18} className={`text-${color}-400 mb-2`} />
            <div className="text-2xl font-bold text-stone-100">{value}</div>
            <div className="text-stone-500 text-xs mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('places')} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === 'places' ? 'bg-amber-500 text-stone-950 font-semibold' : 'bg-stone-800 text-stone-400'}`}>{t('admin.places')}</button>
        <button onClick={() => setTab('events')} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === 'events' ? 'bg-amber-500 text-stone-950 font-semibold' : 'bg-stone-800 text-stone-400'}`}>{t('admin.events')}</button>
      </div>

      {tab === 'places' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-800 text-stone-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">{t('admin.place')}</th>
                <th className="px-4 py-3 text-left">{t('common.city')}</th>
                <th className="px-4 py-3 text-left">{t('common.category')}</th>
                <th className="px-4 py-3 text-left">{t('admin.rating')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {places.map(place => {
                const displayPlace = translatePlace(place)
                return (
                <tr key={place._id} className="hover:bg-stone-800/50 transition-colors">
                  <td className="px-4 py-3 text-stone-200 font-medium">{displayPlace.displayName}</td>
                  <td className="px-4 py-3 text-stone-500">{displayPlace.displayCity}</td>
                  <td className="px-4 py-3"><span className="badge bg-stone-800 text-stone-400 border border-stone-700">{displayPlace.displayCategory || t(`categories.${place.category}`)}</span></td>
                  <td className="px-4 py-3 text-amber-400">{place.rating || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deletePlace(place._id)} className="text-stone-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="text-center py-10 text-stone-600">{t('admin.noEvents')}</div>
          ) : events.map(event => (
            <div key={event._id} className="card p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-stone-200">{translateEvent(event).displayTitle}</div>
                <div className="text-stone-500 text-xs mt-0.5">{translateEvent(event).displayCity} • {translateEvent(event).displayType}</div>
              </div>
              <button onClick={() => deleteEvent(event._id)} className="text-stone-600 hover:text-red-400 transition-colors p-2">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
