import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline, Pane } from 'react-leaflet'
import L from 'leaflet'
import { placesAPI, eventsAPI, citiesAPI, directionsAPI } from '../services/api'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { useRoute } from '../context/RouteContext'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Filter, Zap, MapPin, Star, X, Plus, Clock, Navigation, Trash2, Car, Footprints, Cloud, Sun, CloudRain, CloudLightning, CloudSnow, Wind, Compass, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import EventForm from '../components/EventForm'
import PanoramaModal from '../components/PanoramaModal'
import { has360Imagery } from '../utils/place360'
import axios from 'axios'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { useLanguage } from '../i18n/LanguageContext'
import demoEvents from '../data/demoEvents'

// Custom icons
const placeIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:#f59e0b;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #1c1917;box-shadow:0 2px 8px rgba(0,0,0,0.4)"><span style="display:block;transform:rotate(45deg);text-align:center;line-height:28px;font-size:14px">🏛️</span></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -35],
})

const cityIcon = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;border-radius:50%;background:#f59e0b;border:2px solid #1c1917;box-shadow:0 2px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:15px">🏛️</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
})

const eventIcons = {
  concert: '🎵', flashmob: '💃', popup: '🛍️', exhibition: '🎨',
  festival: '🎉', protest: '📢', other: '⚡',
}

const createEventIcon = (type) => L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:#10b981;border-radius:50%;border:2px solid #1c1917;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:16px;position:relative"><span>${eventIcons[type] || '⚡'}</span><span style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:#22c55e;border-radius:50%;border:1px solid #1c1917;animation:pulse-dot 1.5s infinite"></span></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -22],
})

const liveCulturalEventIcon = L.divIcon({
  className: '',
  html: `<div style="width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fbbf24 0%,#f97316 42%,#991b1b 100%);border:2px solid #facc15;box-shadow:0 0 0 6px rgba(249,115,22,.18),0 0 24px rgba(248,113,22,.85),0 6px 16px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff7ed;font-size:17px;position:relative;animation:pulse-glow 1.8s ease-in-out infinite"><span>✦</span><span style="position:absolute;inset:-8px;border-radius:50%;border:1px solid rgba(251,191,36,.35);animation:pulse-dot 1.8s ease-in-out infinite"></span></div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -22],
})

function MapController({ center, zoom }) {
  const map = useMap()
  useEffect(() => { if (center) map.setView(center, zoom || 13) }, [center, zoom])
  return null
}

function getMapBoundsPayload(map) {
  const bounds = map.getBounds()
  return {
    north: Number(bounds.getNorth().toFixed(6)),
    south: Number(bounds.getSouth().toFixed(6)),
    east: Number(bounds.getEast().toFixed(6)),
    west: Number(bounds.getWest().toFixed(6)),
  }
}

function MapBoundsTracker({ onViewportChange }) {
  const map = useMapEvents({
    moveend: () => onViewportChange(getMapBoundsPayload(map), map.getZoom(), map.getCenter()),
    zoomend: () => onViewportChange(getMapBoundsPayload(map), map.getZoom(), map.getCenter()),
  })

  useEffect(() => {
    onViewportChange(getMapBoundsPayload(map), map.getZoom(), map.getCenter())
  }, [map, onViewportChange])

  return null
}

function MapLayoutSync({ sidebarOpen }) {
  const map = useMap()

  useEffect(() => {
    const timeoutId = window.setTimeout(() => map.invalidateSize(), 260)
    return () => window.clearTimeout(timeoutId)
  }, [map, sidebarOpen])

  return null
}

const categoryOptions = ['all', 'historical', 'museum', 'mosque', 'castle', 'ruins', 'monument', 'cultural']
const DEFAULT_MAP_VIEW = {
  center: [39.1, 35.0],
  zoom: 6,
}

const isValidCenter = (center) => (
  Array.isArray(center) &&
  center.length === 2 &&
  center.every((value) => Number.isFinite(Number(value)))
)

const getWeatherIcon = (code) => {
  if (code === 0) return <Sun size={14} className="text-amber-400" />
  if (code >= 1 && code <= 3) return <Cloud size={14} className="text-stone-400" />
  if (code >= 51 && code <= 67) return <CloudRain size={14} className="text-blue-400" />
  if (code >= 71 && code <= 77) return <CloudSnow size={14} className="text-stone-100" />
  if (code >= 80 && code <= 82) return <CloudRain size={14} className="text-blue-500" />
  if (code >= 95) return <CloudLightning size={14} className="text-purple-400" />
  return <Wind size={14} className="text-stone-500" />
}

const isRainy = (code) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95

const formatDistance = (m) => {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

const formatTime = (s, language = 'tr') => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (language === 'en') {
    if (h > 0) return `${h} hr ${m} min`
    return `${m} min`
  }
  if (h > 0) return `${h} sa ${m} dk`
  return `${m} dk`
}

const getEventDate = (event) => new Date(`${event.date}T${event.time}:00`)

const getEventStatus = (event) => {
  const eventDate = getEventDate(event)
  const diffMs = eventDate.getTime() - Date.now()
  const liveWindowMs = 2 * 60 * 60 * 1000

  if (Math.abs(diffMs) <= liveWindowMs) return 'live'
  if (diffMs > 0) return 'upcoming'
  return null
}

function useDebouncedValue(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [value, delay])

  return debouncedValue
}

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;

/** Hazır rotada yalnızca ilgili ile kayıtlı mekanlar kullanılsın (DB place.city === route.city). */
const placeMatchesRouteCity = (place, routeCity) => {
  if (!place?.city || !routeCity) return false
  const a = String(place.city).trim()
  const b = String(routeCity).trim()
  return a.localeCompare(b, 'tr', { sensitivity: 'accent' }) === 0
}

const PREDEFINED_ROUTES = [
  {
    id: 'istanbul-osmanli',
    name: 'İstanbul: Osmanlı Turu',
    nameEn: 'Istanbul: Ottoman Tour',
    city: 'İstanbul',
    description: 'Sultanahmet merkezli klasik bir rota.',
    descriptionEn: 'A classic route centered around Sultanahmet.',
    placeNames: ['Topkapı Sarayı', 'Ayasofya', 'Sultanahmet Camii', 'Kapalıçarşı', 'Rumeli Hisarı']
  },
  {
    id: 'ankara-milli',
    name: 'Ankara: Milli Mücadele',
    nameEn: 'Ankara: War of Independence',
    city: 'Ankara',
    description: 'Cumhuriyetin kuruluş izleri.',
    descriptionEn: 'Traces of the Republic’s founding years.',
    placeNames: ['Anıtkabir', 'Ankara Kalesi', 'Anadolu Medeniyetleri Müzesi', 'Haci Bayram Veli Camii']
  },
  {
    id: 'konya-mevlana',
    name: 'Konya: Mevlana İzinde',
    nameEn: 'Konya: In Mevlana’s Footsteps',
    city: 'Konya',
    description: 'Selçuklu ve Mevlevilik kültürü.',
    descriptionEn: 'Seljuk heritage and Mevlevi culture.',
    placeNames: ['Mevlana Müzesi', 'Alaeddin Camii', 'Sille']
  },
  {
    id: 'izmir-ege',
    name: 'İzmir: Ege Antikleri',
    nameEn: 'Izmir: Aegean Antiquities',
    city: 'İzmir',
    description: 'İzmir ili sınırları içindeki antik ve kent merkezi durakları.',
    descriptionEn: 'Ancient sites and city-center stops across Izmir.',
    placeNames: ['Kemeraltı Çarşısı', 'Agora Ören Yeri', 'Kadifekale', 'Efes Antik Kenti']
  },
  {
    id: 'bursa-osmanli-baskent',
    name: 'Bursa: Osmanlı Başkenti',
    nameEn: 'Bursa: Ottoman Capital',
    city: 'Bursa',
    description: 'Yeşil, hanlar ve erken dönem Osmanlı izleri.',
    descriptionEn: 'Green Bursa, historic inns, and early Ottoman traces.',
    placeNames: ['Yeşil Camii', 'Koza Han', 'Muradiye Külliyesi', 'Bursa Kalesi']
  },
  {
    id: 'edirne-saray',
    name: 'Edirne: Sinan ve Saray',
    nameEn: 'Edirne: Sinan and Palace Route',
    city: 'Edirne',
    description: 'Selimiye merkezli klasik Edirne turu.',
    descriptionEn: 'A classic Edirne tour centered around Selimiye.',
    placeNames: ['Selimiye Camii', 'Eski Camii', 'Üç Şerefeli Camii', 'Meriç Köprüsü']
  },
  {
    id: 'antalya-antik',
    name: 'Antalya: Pamfilya Kalıntıları',
    nameEn: 'Antalya: Pamphylian Ruins',
    city: 'Antalya',
    description: 'Perge ve Aspendos antik mirası.',
    descriptionEn: 'The ancient heritage of Perge and Aspendos.',
    placeNames: ['Perge Antik Kenti', 'Aspendos Tiyatrosu']
  },
  {
    id: 'cappadocia-peri',
    name: 'Kapadokya: Peri Bacaları',
    nameEn: 'Cappadocia: Fairy Chimneys',
    city: 'Cappadocia',
    description: 'Yeraltı şehirleri ve vadiler.',
    descriptionEn: 'Underground cities and valleys.',
    placeNames: ['Derinkuyu Yeraltı Şehri', 'Kaymakli Yeralti Sehri', 'Göreme Açık Hava Müzesi', 'Uchisar Kalesi']
  },
  {
    id: 'samsun-kurtulus',
    name: 'Samsun: Kurtuluş Rotası',
    nameEn: 'Samsun: Independence Route',
    city: 'Samsun',
    description: 'Bandırma’dan İlkadım’a Milli Mücadele hafızası.',
    descriptionEn: 'Memory of the National Struggle from Bandırma to İlkadım.',
    placeNames: ['Bandırma Gemi-Müzesi', 'İlkadım Anıtı', 'Kurtuluş Yolu Başlangıç Noktası']
  },
  {
    id: 'canakkale-troya',
    name: 'Çanakkale: Troya’dan Gelibolu’ya',
    nameEn: 'Canakkale: From Troy to Gallipoli',
    city: 'Çanakkale',
    description: 'Antik kentler ve yakın tarih.',
    descriptionEn: 'Ancient cities and modern history.',
    placeNames: ['Troya Antik Kenti', 'Assos Antik Kenti', 'Çanakkale Şehitler Abidesi', 'Kilitbahir Kalesi']
  },
  {
    id: 'gaziantep-mozaik',
    name: 'Gaziantep: Mozaik ve Çarşı',
    nameEn: 'Gaziantep: Mosaics and Bazaar',
    city: 'Gaziantep',
    description: 'Zeugma’dan bakırcılar çarşısına.',
    descriptionEn: 'From Zeugma to the coppersmiths’ bazaar.',
    placeNames: ['Zeugma Mozaik Müzesi', 'Gaziantep Kalesi', 'Bakırcılar Çarşısı', 'Zincirli Bedesten']
  },
  {
    id: 'sanliurfa-peygamber',
    name: 'Şanlıurfa: Tarihin Başlangıcı',
    nameEn: 'Sanliurfa: The Beginning of History',
    city: 'Şanlıurfa',
    description: 'Göbeklitepe, Harran ve kutsal merkez.',
    descriptionEn: 'Gobeklitepe, Harran, and the sacred center.',
    placeNames: ['Göbeklitepe', 'Balıklıgöl', 'Haleplibahçe Mozaik Müzesi', 'Harran Antik Kenti']
  },
  {
    id: 'denizli-pamukkale',
    name: 'Denizli: Traverten ve Antik Kentler',
    nameEn: 'Denizli: Travertines and Ancient Cities',
    city: 'Denizli',
    description: 'Pamukkale ve çevresindeki ören yerleri.',
    descriptionEn: 'Pamukkale and the ancient sites around it.',
    placeNames: ['Pamukkale Travertenleri', 'Hierapolis Antik Kenti', 'Laodikeia Antik Kenti']
  },
  {
    id: 'diyarbakir-sur',
    name: 'Diyarbakır: Surlar ve Dicle',
    nameEn: 'Diyarbakir: Walls and the Tigris',
    city: 'Diyarbakır',
    description: 'UNESCO surları ve Hevsel bahçeleri.',
    descriptionEn: 'UNESCO city walls and the Hevsel Gardens.',
    placeNames: ['Diyarbakır Surları', 'Hevsel Bahçeleri', 'Hasan Paşa Hanı']
  },
  {
    id: 'mardin-tas',
    name: 'Mardin: Taş Şehir',
    nameEn: 'Mardin: Stone City',
    city: 'Mardin',
    description: 'Medreseler ve Süryani mirası.',
    descriptionEn: 'Madrasas and Syriac heritage.',
    placeNames: ['Mardin Eski Şehir', 'Kasımiye Medresesi', 'Deyrulzafaran Manastırı']
  },
  {
    id: 'van-urartu',
    name: 'Van: Urartu İzleri',
    nameEn: 'Van: Urartian Traces',
    city: 'Van',
    description: 'Tuşpa, müze ve Akdamar.',
    descriptionEn: 'Tushpa, the museum, and Akdamar.',
    placeNames: ['Van Kalesi', 'Van Müzesi', 'Akdamar Kilisesi']
  }
];

export default function MapPage() {
  const { language, t, translateCity, translatePlace, translateEvent, translateEntity } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isLiveTab = searchParams.get('tab') === 'live'
  const eventMarkerRefs = useRef({})
  const { user } = useAuth()
  const { liveEvents, setLiveEvents, joinCity, leaveCity } = useSocket()
  const { routePlaces, addToRoute, removeFromRoute, clearRoute, setRoutePlaces } = useRoute()
  const [places, setPlaces] = useState([])
  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showEvents, setShowEvents] = useState(true)
  const [showPlaces, setShowPlaces] = useState(true)
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_VIEW.center)
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_VIEW.zoom)
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_MAP_VIEW.zoom)
  const [currentMapCenter, setCurrentMapCenter] = useState(DEFAULT_MAP_VIEW.center)
  const [showEventForm, setShowEventForm] = useState(false)
  const [panoramaPlace, setPanoramaPlace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [routeSummary, setRouteSummary] = useState(null)
  const [walkingSummary, setWalkingSummary] = useState(null)
  const [routePolyline, setRoutePolyline] = useState([])
  const [walkingPolyline, setWalkingPolyline] = useState([])
  const [weather, setWeather] = useState(null)
  const [showPredefined, setShowPredefined] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [viewportBounds, setViewportBounds] = useState(null)
  const debouncedSearchTerm = useDebouncedValue(searchTerm.trim(), 300)
  const debouncedViewportBounds = useDebouncedValue(viewportBounds, 180)
  const shouldRenderPlaceMarkers = currentZoom >= 8 || Boolean(selectedCity || debouncedSearchTerm || selectedCategory !== 'all')
  const totalPlaceCount = selectedCity
    ? places.length
    : cities.reduce((sum, city) => sum + (city.placeCount || 0), 0)

  const getDemoEventTitle = (event) => language === 'tr' ? event.titleTR : event.titleEN
  const getDemoEventDescription = (event) => language === 'tr' ? event.descriptionTR : event.descriptionEN
  const getDemoEventStatusLabel = (status) => {
    if (status === 'live') return language === 'tr' ? t('map.liveStatus') : 'LIVE'
    return language === 'tr' ? t('map.upcoming') : 'UPCOMING'
  }
  const getRouteName = (route) => language === 'tr' ? route.name : route.nameEn
  const getRouteDescription = (route) => language === 'tr' ? route.description : route.descriptionEn
  const predefinedRoutesLabel = language === 'tr' ? 'Hazır Rotalar' : 'Ready Routes'
  const predefinedRoutesTitle = language === 'tr' ? 'Hazır Tematik Rotalar' : 'Ready Thematic Routes'
  const sortedCities = [...cities].sort((a, b) =>
    translateCity(a).displayName.localeCompare(translateCity(b).displayName, language === 'tr' ? 'tr' : 'en', {
      sensitivity: 'base',
      numeric: true,
    })
  )
  const visibleDemoEvents = demoEvents
    .map(event => ({
      ...event,
      computedStatus: getEventStatus(event),
      eventDate: getEventDate(event),
    }))
    .filter(event => event.computedStatus)
    .sort((a, b) => {
      if (a.computedStatus !== b.computedStatus) return a.computedStatus === 'live' ? -1 : 1
      return a.eventDate - b.eventDate
    })
  const displayedEvents = liveEvents.length > 0 ? liveEvents : visibleDemoEvents
  const focusDemoEvent = (event) => {
    setMapCenter(event.coordinates)
    setMapZoom(13)
    window.setTimeout(() => {
      eventMarkerRefs.current[event.id]?.openPopup()
    }, 120)
  }
  const handleViewportChange = useCallback((bounds, zoom, center) => {
    setCurrentZoom(zoom)
    if (center) {
      const nextCenter = [center.lat, center.lng]
      setCurrentMapCenter(current => {
        if (
          current &&
          Math.abs(current[0] - nextCenter[0]) < 0.000001 &&
          Math.abs(current[1] - nextCenter[1]) < 0.000001
        ) {
          return current
        }
        return nextCenter
      })
    }
    setViewportBounds(current => {
      if (
        current &&
        current.north === bounds.north &&
        current.south === bounds.south &&
        current.east === bounds.east &&
        current.west === bounds.west
      ) {
        return current
      }
      return bounds
    })
  }, [])

  const resetMapView = useCallback(() => {
    setSelectedCity(null)
    setSelectedCategory('all')
    setSearchTerm('')
    setShowEvents(true)
    setShowPlaces(true)
    setShowEventForm(false)
    setPanoramaPlace(null)
    setShowPredefined(false)
    setViewportBounds(null)
    setMapCenter(DEFAULT_MAP_VIEW.center)
    setCurrentMapCenter(DEFAULT_MAP_VIEW.center)
    setMapZoom(DEFAULT_MAP_VIEW.zoom)
    setCurrentZoom(DEFAULT_MAP_VIEW.zoom)
  }, [])

  const getReturnMapState = (place) => {
    const params = searchParams.toString()

    return {
      center: isValidCenter(currentMapCenter) ? currentMapCenter : mapCenter,
      zoom: currentZoom || mapZoom,
      cityId: selectedCity?._id || null,
      cityName: selectedCity?.name || place?.city || null,
      selectedCategory,
      searchTerm,
      showPlaces,
      showEvents,
      search: params ? `?${params}` : '',
    }
  }

  useEffect(() => {
    if (isLiveTab) {
      setShowPlaces(false)
      setShowEvents(true)
    }
  }, [isLiveTab])

  useEffect(() => {
    citiesAPI.getAll().then(res => setCities(res.data))
  }, [])

  useEffect(() => {
    if (location.state?.resetMap) {
      resetMapView()
      navigate('/map', { replace: true, state: null })
      return
    }

    const restoreMap = location.state?.restoreMap
    if (!restoreMap) return

    const hasCityFocus = Boolean(restoreMap.cityId || restoreMap.cityName)
    const restoredCity = hasCityFocus
      ? cities.find(city => city._id === restoreMap.cityId || city.name === restoreMap.cityName)
      : null

    if (hasCityFocus && !restoredCity && cities.length === 0) return

    const restoredCenter = isValidCenter(restoreMap.center)
      ? restoreMap.center.map(Number)
      : (restoredCity ? [restoredCity.location.coordinates[1], restoredCity.location.coordinates[0]] : DEFAULT_MAP_VIEW.center)
    const restoredZoom = Number.isFinite(Number(restoreMap.zoom)) ? Number(restoreMap.zoom) : DEFAULT_MAP_VIEW.zoom

    setSelectedCity(restoredCity || null)
    setSelectedCategory(restoreMap.selectedCategory || 'all')
    setSearchTerm(restoreMap.searchTerm || '')
    if (typeof restoreMap.showPlaces === 'boolean') setShowPlaces(restoreMap.showPlaces)
    if (typeof restoreMap.showEvents === 'boolean') setShowEvents(restoreMap.showEvents)
    setShowEventForm(false)
    setPanoramaPlace(null)
    setShowPredefined(false)
    setMapCenter(restoredCenter)
    setCurrentMapCenter(restoredCenter)
    setMapZoom(restoredZoom)
    setCurrentZoom(restoredZoom)

    navigate(`/map${restoreMap.search || ''}`, { replace: true, state: null })
  }, [cities, location.state, navigate, resetMapView])

  // Fetch Weather
  useEffect(() => {
    if (!selectedCity) {
      setWeather(null)
      return
    }

    const fetchWeather = async () => {
      try {
        const [lng, lat] = selectedCity.location.coordinates
        const res = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
        setWeather(res.data.current_weather)
      } catch (err) {
        console.error('Weather fetch error:', err)
      }
    }

    fetchWeather()
  }, [selectedCity])

  // Fetch both driving and walking route summaries and geometries from backend API
  useEffect(() => {
    if (routePlaces.length < 2) {
      setRouteSummary(null)
      setWalkingSummary(null)
      setRoutePolyline([])
      setWalkingPolyline([])
      return
    }

    const ac = new AbortController()

    const fetchRoutes = async () => {
      const coordinates = routePlaces.map(p => [p.location.coordinates[0], p.location.coordinates[1]])
      
      try {
        // Clear summaries to show loading state
        setRouteSummary(null)
        setWalkingSummary(null)
        setRoutePolyline([])
        setWalkingPolyline([])

        const [driveRes, walkRes] = await Promise.allSettled([
          directionsAPI.route(coordinates, 'driving-car', { signal: ac.signal }),
          directionsAPI.route(coordinates, 'foot-walking', { signal: ac.signal })
        ]);

        if (ac.signal.aborted) return;

        // Handle Driving Result
        if (driveRes.status === 'fulfilled' && driveRes.value.data) {
          const data = driveRes.value.data;
          setRoutePolyline(data.geometry || []);
          setRouteSummary({
            distance: data.distance,
            time: data.duration
          });
        }

        // Handle Walking Result
        if (walkRes.status === 'fulfilled' && walkRes.value.data) {
          const data = walkRes.value.data;
          setWalkingPolyline(data.geometry || []);
          setWalkingSummary({
            distance: data.distance,
            time: data.duration
          });
        }
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error('Route fetching error:', err);
        }
      }
    }

    fetchRoutes()
    return () => ac.abort()
  }, [routePlaces])

  useEffect(() => {
    if (!debouncedViewportBounds) return

    if (!shouldRenderPlaceMarkers) {
      setPlaces([])
      setLoading(false)
      return
    }

    const params = {}
    if (selectedCity) params.city = selectedCity.name
    if (selectedCategory !== 'all') params.category = selectedCategory
    if (debouncedSearchTerm) params.search = debouncedSearchTerm
    if (!debouncedSearchTerm) Object.assign(params, debouncedViewportBounds)

    const ac = new AbortController()
    setLoading(true)

    placesAPI.getAll({ ...params, limit: 500, view: 'map' }, { signal: ac.signal })
      .then(res => {
        setPlaces(res.data.places)
        setLoading(false)
      })
      .catch(err => {
        if (!axios.isCancel(err) && err.name !== 'CanceledError') {
          console.error('Places fetch error:', err)
          setLoading(false)
        }
      })

    if (selectedCity) {
      eventsAPI.getAll({ city: selectedCity.name }).then(res => setLiveEvents(res.data))
      joinCity(selectedCity._id)
      return () => {
        ac.abort()
        leaveCity(selectedCity._id)
      }
    }

    return () => ac.abort()
  }, [selectedCity, selectedCategory, debouncedSearchTerm, debouncedViewportBounds, shouldRenderPlaceMarkers])

  const handleCitySelect = (city) => {
    const nextCenter = [city.location.coordinates[1], city.location.coordinates[0]]
    setSelectedCity(city)
    setMapCenter(nextCenter)
    setCurrentMapCenter(nextCenter)
    setMapZoom(13)
    setCurrentZoom(13)
  }

  const handleEventCreated = (event) => {
    setLiveEvents(prev => [event, ...prev])
    setShowEventForm(false)
    toast.success(t('map.eventReported'))
  }

  const handleLoadPredefined = async (route) => {
    try {
      const bulkRes = await placesAPI.getAll({ city: route.city, limit: 2000 })
      const inCity = bulkRes.data.places || []

      const selectedPlaces = []
      const missing = []
      for (const name of route.placeNames) {
        const fromSidebar = places.find((p) => p.name === name && placeMatchesRouteCity(p, route.city))
        if (fromSidebar) {
          selectedPlaces.push(fromSidebar)
          continue
        }
        let match = inCity.find((p) => p.name === name && placeMatchesRouteCity(p, route.city))
        if (!match) match = inCity.find((p) => p.name === name)
        if (match && placeMatchesRouteCity(match, route.city)) {
          selectedPlaces.push(match)
          continue
        }
        const searched = await placesAPI.getAll({ city: route.city, search: name, limit: 80 })
        const hits = searched.data.places || []
        match = hits.find((p) => p.name === name && placeMatchesRouteCity(p, route.city))
        if (match) selectedPlaces.push(match)
        else missing.push(name)
      }

      if (selectedPlaces.length > 0) {
        setRoutePlaces(selectedPlaces)
        const city = cities.find((c) => c.name === route.city)
        if (city) handleCitySelect(city)

        if (missing.length > 0) {
          toast.success(
            language === 'tr'
              ? `${getRouteName(route)}: ${selectedPlaces.length}/${route.placeNames.length} mekan yüklendi. Bulunamayan: ${missing.join(', ')}`
              : `${getRouteName(route)}: ${selectedPlaces.length}/${route.placeNames.length} places loaded. Missing: ${missing.join(', ')}`
          )
        } else {
          toast.success(language === 'tr' ? `${getRouteName(route)} yüklendi!` : `${getRouteName(route)} loaded!`)
        }
        setShowPredefined(false)
      } else {
        toast.error(
          language === 'tr'
            ? `Bu rota için ${route.city} ili kayıtlarında mekan bulunamadı.`
            : `No places were found in ${translateEntity(route.city)} records for this route.`
        )
      }
    } catch (err) {
      console.error('Error loading predefined route:', err)
      toast.error(language === 'tr' ? 'Rota yüklenirken hata oluştu.' : 'An error occurred while loading the route.')
    }
  }

  return (
    <div className="relative h-[calc(100vh-72px)] flex overflow-hidden">
      {/* Sidebar */}
      <div
        className={`absolute inset-y-0 left-0 z-[1100] flex w-[min(20rem,calc(100vw-4.75rem))] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-stone-200 bg-white shadow-2xl transition-all duration-300 ease-out dark:border-stone-800 dark:bg-stone-900 lg:relative lg:z-auto lg:shadow-none ${
          sidebarOpen ? 'translate-x-0 lg:w-80' : '-translate-x-full lg:w-0 lg:translate-x-0 lg:border-r-0'
        }`}
      >
        <div className="flex items-center justify-end border-b border-stone-200 p-2 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-stone-950 text-amber-400 shadow-sm transition-colors hover:bg-amber-500 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-amber-400/70"
            title={language === 'tr' ? 'Paneli kapat' : 'Close panel'}
            aria-label={language === 'tr' ? 'Paneli kapat' : 'Close panel'}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        {/* Search */}
        <div className="p-3 border-b border-stone-200 dark:border-stone-800">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
            <input
              className="input pl-9 text-sm py-2"
              placeholder={t('map.search')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Cities */}
        <div className="p-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t('map.selectCity')}</div>
            {weather && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded-full border border-stone-200 dark:border-stone-700 transition-colors">
                {getWeatherIcon(weather.weathercode)}
                <span className="text-[11px] font-bold text-stone-700 dark:text-stone-200">{Math.round(weather.temperature)}°C</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            <button
              onClick={() => { setSelectedCity(null); setMapCenter(DEFAULT_MAP_VIEW.center); setCurrentMapCenter(DEFAULT_MAP_VIEW.center); setMapZoom(DEFAULT_MAP_VIEW.zoom); setCurrentZoom(DEFAULT_MAP_VIEW.zoom) }}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${!selectedCity ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'}`}
            >{t('common.allTurkey')}</button>
            {sortedCities.map(city => (
              <button
                key={city._id}
                onClick={() => handleCitySelect(city)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${selectedCity?._id === city._id ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'}`}
              >{translateCity(city).displayName}</button>
            ))}
          </div>
        </div>

        {/* Weather Suggestion */}
        {weather && isRainy(weather.weathercode) && (
          <div className="p-3 bg-blue-500/5 dark:bg-blue-500/10 border-b border-blue-200 dark:border-blue-500/20 transition-colors">
            <button 
              onClick={() => setSelectedCategory('museum')}
              className="w-full flex items-center justify-between p-2 bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 border border-blue-200 dark:border-blue-500/30 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-2">
                <CloudRain size={16} className="text-blue-500 dark:text-blue-400 animate-bounce" />
                <div className="text-left">
                  <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 leading-none">{t('map.rainyTitle')}</div>
                  <div className="text-[10px] text-blue-500/70 dark:text-blue-300/70 mt-0.5">{t('map.rainyText')}</div>
                </div>
              </div>
              <Plus size={14} className="text-blue-500 dark:text-blue-400 group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        )}

        {/* Layer toggles */}
        <div className="p-3 border-b border-stone-200 dark:border-stone-800 flex gap-2">
          <button
            onClick={() => setShowPlaces(!showPlaces)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors flex-1 justify-center ${showPlaces ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'}`}
          >🏛️ {t('map.places')} ({shouldRenderPlaceMarkers ? places.length : totalPlaceCount})</button>
          <button
            onClick={() => setShowEvents(!showEvents)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors flex-1 justify-center ${showEvents ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'}`}
          >⚡ {isLiveTab ? t('map.liveCulturalEvents') : t('map.live')} ({isLiveTab ? visibleDemoEvents.length : displayedEvents.length})</button>
        </div>

        {isLiveTab && (
          <div className="flex-1 flex flex-col overflow-hidden bg-stone-950">
            <div className="p-3 border-b border-amber-500/20 bg-stone-950/95">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Zap size={14} />
                {t('map.liveCulturalEvents')} ({visibleDemoEvents.length})
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {visibleDemoEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="w-12 h-12 bg-stone-900 rounded-full flex items-center justify-center mb-3 text-amber-400 border border-amber-500/20">
                    <Zap size={20} />
                  </div>
                  <div className="text-sm font-semibold text-amber-300">{t('map.noLiveEvents')}</div>
                  <p className="text-stone-500 text-xs leading-relaxed mt-1">{t('map.noLiveEventsNow')}</p>
                </div>
              ) : (
                visibleDemoEvents.map(event => (
                  <button
                    key={event.id}
                    onClick={() => focusDemoEvent(event)}
                    className="group w-full text-left p-3 rounded-xl border border-amber-500/15 bg-stone-900/80 hover:border-orange-400/50 hover:bg-stone-900 transition-all shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-stone-100 group-hover:text-amber-200 transition-colors line-clamp-2">
                          {getDemoEventTitle(event)}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-stone-400">
                          <MapPin size={12} className="text-amber-500" />
                          <span className="truncate">{event.city}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${event.computedStatus === 'live' ? 'bg-red-500/15 text-red-300 border border-red-400/30' : 'bg-amber-400/15 text-amber-200 border border-amber-300/30'}`}>
                        {getDemoEventStatusLabel(event.computedStatus)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-500">
                      <Clock size={12} className="text-orange-400" />
                      <span>{event.date} · {event.time}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Route Section */}
        {!isLiveTab && (
        <div className="flex-1 flex flex-col overflow-hidden bg-stone-50/50 dark:bg-stone-950/30">
          <div className="p-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-white dark:bg-stone-900/50">
            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Navigation size={14} />
              {t('map.myRoute')} ({routePlaces.length})
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowPredefined(!showPredefined)}
                className={`p-1.5 rounded-lg transition-colors ${showPredefined ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600' : 'text-stone-400 hover:text-amber-500'}`}
                title={predefinedRoutesLabel}
              >
                <Compass size={16} />
              </button>
              {routePlaces.length > 0 && (
                <button onClick={clearRoute} className="text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
            {showPredefined && (
              <div className="absolute inset-0 z-10 bg-white/95 dark:bg-stone-900/95 p-3 space-y-3 animate-in slide-in-from-right">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-stone-500 uppercase tracking-tighter">{predefinedRoutesTitle}</div>
                  <button onClick={() => setShowPredefined(false)} className="text-stone-400 hover:text-stone-600"><X size={14}/></button>
                </div>
                {PREDEFINED_ROUTES.map(route => (
                  <button
                    key={route.id}
                    onClick={() => handleLoadPredefined(route)}
                    className="w-full text-left p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-500 transition-all bg-white dark:bg-stone-800 group"
                  >
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-500 mb-1">{translateEntity(route.city)}</div>
                    <div className="text-sm font-semibold text-stone-800 dark:text-stone-200 group-hover:text-amber-600 transition-colors">{getRouteName(route)}</div>
                    <div className="text-[10px] text-stone-500 mt-1">{getRouteDescription(route)}</div>
                  </button>
                ))}
              </div>
            )}

            {routePlaces.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-12 h-12 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-3 text-stone-300 dark:text-stone-600">
                  <Navigation size={20} />
                </div>
                <p className="text-stone-400 dark:text-stone-500 text-xs leading-relaxed">
                  {t('map.emptyRoute')}<br/>{t('map.emptyRouteHint')}
                </p>
              </div>
            ) : (
              <>
                {routePlaces.map((place, index) => (
                  <div key={place._id} className="group relative flex items-center gap-3 p-2 bg-white dark:bg-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700/50 transition-all">
                    <div className="w-6 h-6 shrink-0 bg-amber-500 text-stone-950 rounded-full flex items-center justify-center text-[10px] font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">{translatePlace(place).displayName}</div>
                      <div className="text-[10px] text-stone-400 dark:text-stone-500">{translatePlace(place).displayCity}</div>
                    </div>
                    <button 
                      onClick={() => removeFromRoute(place._id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {routePlaces.length >= 2 && (routeSummary || walkingSummary) && (
                  <div className="mt-4 p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-3 animate-fade-in shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                        <Car size={14} className="text-amber-500" />
                        <span className="text-xs">{t('map.driving')}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-amber-600 dark:text-amber-500">
                          {routeSummary ? formatTime(routeSummary.time, language) : '—'}
                        </div>
                        <div className="text-[10px] text-stone-400 dark:text-stone-600 font-mono">
                          {routeSummary ? formatDistance(routeSummary.distance) : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-stone-100 dark:bg-stone-800" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                        <Footprints size={14} className="text-emerald-500" />
                        <span className="text-xs">{t('map.walking')}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-500">
                          {walkingSummary ? formatTime(walkingSummary.time, language) : '—'}
                        </div>
                        <div className="text-[10px] text-stone-400 dark:text-stone-600 font-mono">
                          {walkingSummary ? formatDistance(walkingSummary.distance) : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 top-4 z-[1000] inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/40 bg-stone-950/95 text-amber-400 shadow-2xl backdrop-blur transition-colors hover:bg-amber-500 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-amber-400/70"
            title={language === 'tr' ? 'Paneli aç' : 'Open panel'}
            aria-label={language === 'tr' ? 'Paneli aç' : 'Open panel'}
          >
            <PanelLeftOpen size={20} />
          </button>
        )}
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          preferCanvas
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapController center={mapCenter} zoom={mapZoom} />
          <MapBoundsTracker onViewportChange={handleViewportChange} />
          <MapLayoutSync sidebarOpen={sidebarOpen} />

          {/* Sürüş Rotası (Sarı - Alt katman) */}
          <Pane name="driving-route-pane" style={{ zIndex: 430, pointerEvents: 'none' }}>
            {routePolyline.length >= 2 && (
              <>
                <Polyline
                  positions={routePolyline}
                  interactive={false}
                  pathOptions={{
                    color: '#1c1917',
                    weight: 11,
                    opacity: 0.35,
                    interactive: false,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                <Polyline
                  positions={routePolyline}
                  interactive={false}
                  pathOptions={{
                    color: '#f59e0b',
                    weight: 7,
                    opacity: 1,
                    interactive: false,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </>
            )}
          </Pane>

          {/* Yürüyüş Rotası (Yeşil Kesikli - Üst katman) */}
          <Pane name="walking-route-pane" style={{ zIndex: 440, pointerEvents: 'none' }}>
            {walkingPolyline.length >= 2 && (
              <>
              {/* Kontrast için Beyaz Dış Çerçeve */}
              <Polyline
                positions={walkingPolyline}
                interactive={false}
                pathOptions={{
                  color: '#ffffff',
                  weight: 6,
                  opacity: 0.65,
                  dashArray: '6, 12',
                  interactive: false,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Belirgin Yeşil Kesikli Hat */}
              <Polyline
                positions={walkingPolyline}
                interactive={false}
                pathOptions={{
                  color: '#16a34a', // Daha güçlü bir yeşil
                  weight: 4,
                  opacity: 0.95,
                  dashArray: '6, 12',
                  interactive: false,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              </>
            )}
          </Pane>

          {/* City markers at low zoom keep the all-Turkey view light. */}
          {!isLiveTab && showPlaces && !shouldRenderPlaceMarkers && sortedCities.map(city => {
            const displayCity = translateCity(city)

            return (
              <Marker
                key={city._id}
                position={[city.location.coordinates[1], city.location.coordinates[0]]}
                icon={cityIcon}
              >
                <Popup>
                  <div className="min-w-[170px]">
                    <div className="font-semibold text-stone-100 text-sm mb-1">{displayCity.displayName}</div>
                    <div className="text-stone-400 text-xs mb-3">{t('city.historicalPlaces', { count: city.placeCount || 0 })}</div>
                    <button
                      onClick={() => handleCitySelect(city)}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold py-1.5 rounded-lg transition-colors"
                    >
                      {t('common.openMap')}
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Place markers */}
          {!isLiveTab && showPlaces && shouldRenderPlaceMarkers && places.map(place => (
            <Marker
              key={place._id}
              position={[place.location.coordinates[1], place.location.coordinates[0]]}
              icon={placeIcon}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <div className="font-semibold text-stone-100 text-sm mb-1">{translatePlace(place).displayName}</div>
                  <div className="text-stone-400 text-xs mb-3 line-clamp-2">{translatePlace(place).displayDescription}</div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addToRoute(place)}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> {t('map.addToRoute')}
                    </button>
                    {has360Imagery(place) && (
                      <button
                        onClick={() => setPanoramaPlace(place)}
                        className="bg-stone-800 hover:bg-stone-700 text-stone-200 p-1.5 rounded-lg transition-colors"
                        title="360 View"
                      >
                        <Zap size={14} />
                      </button>
                    )}
                  </div>
                  <Link
                    to={`/place/${place._id}`}
                    state={{ returnMapState: getReturnMapState(place) }}
                    className="block text-center text-stone-500 text-[10px] mt-2 hover:text-stone-300 transition-colors"
                  >
                    {t('map.viewDetails')}
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Event markers */}
          {isLiveTab && visibleDemoEvents.map(event => (
            <Marker
              key={event.id}
              ref={(marker) => {
                if (marker) eventMarkerRefs.current[event.id] = marker
              }}
              position={event.coordinates}
              icon={liveCulturalEventIcon}
            >
              <Popup>
                <div className="min-w-[220px] rounded-xl bg-stone-950 text-stone-100">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="font-semibold text-amber-200 text-sm leading-snug">{getDemoEventTitle(event)}</div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${event.computedStatus === 'live' ? 'bg-red-500/20 text-red-200 border border-red-400/40' : 'bg-amber-400/20 text-amber-100 border border-amber-300/40'}`}>
                      {getDemoEventStatusLabel(event.computedStatus)}
                    </span>
                  </div>
                  <div className="text-stone-300 text-xs mb-1">{event.city} · {event.venue}</div>
                  <div className="flex items-center gap-1.5 text-orange-300 text-xs mb-3">
                    <Clock size={12} />
                    <span>{event.date} · {event.time}</span>
                  </div>
                  <div className="text-stone-400 text-xs leading-relaxed">{getDemoEventDescription(event)}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {!isLiveTab && showEvents && displayedEvents.map(event => {
            const isDemoEvent = !event._id
            const eventTitle = isDemoEvent ? getDemoEventTitle(event) : translateEvent(event).displayTitle
            const eventDescription = isDemoEvent ? getDemoEventDescription(event) : translateEvent(event).displayDescription
            const eventMeta = isDemoEvent
              ? `${event.city}${event.venue ? ` · ${event.venue}` : ''}`
              : translateEvent(event).displayCity
            const eventTime = isDemoEvent
              ? `${event.date} · ${event.time}`
              : formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: language === 'tr' ? tr : enUS })

            return (
              <Marker
                key={event._id || event.id}
                position={isDemoEvent ? event.coordinates : [event.location.coordinates[1], event.location.coordinates[0]]}
                icon={isDemoEvent ? liveCulturalEventIcon : createEventIcon(event.type)}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="live-dot w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      <span className="text-emerald-400 text-xs">{isDemoEvent ? getDemoEventStatusLabel(event.computedStatus) : t('map.liveEvent')}</span>
                    </div>
                    <div className="font-semibold text-stone-100 text-sm">{eventTitle}</div>
                    <div className="text-stone-500 text-xs mt-1">{eventMeta}</div>
                    <div className="text-stone-400 text-xs mt-1">{eventDescription}</div>
                    <div className="text-stone-500 text-xs mt-1">{eventTime}</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        {/* Floating add event button */}
        {!isLiveTab && user && selectedCity && (
          <button
            onClick={() => setShowEventForm(true)}
            className="absolute bottom-6 left-6 z-[1000] flex items-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-2xl transition-all active:scale-95 font-medium text-sm"
          >
            <Zap size={16} /> {t('map.reportEvent')}
          </button>
        )}
      </div>

      {/* Event form modal */}
      {showEventForm && (
        <EventForm
          selectedCity={selectedCity}
          onClose={() => setShowEventForm(false)}
          onCreated={handleEventCreated}
        />
      )}

      {/* Panorama modal */}
      {panoramaPlace && (
        <PanoramaModal
          place={panoramaPlace}
          onClose={() => setPanoramaPlace(null)}
        />
      )}
    </div>
  )
}
