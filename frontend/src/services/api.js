import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('citylore_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    delete config.headers.Authorization
  }
  return config
})

// Places
export const placesAPI = {
  getAll: (params, config = {}) => api.get('/places', { ...config, params }),
  getOne: (id) => api.get(`/places/${id}`),
  create: (data) => api.post('/places', data),
  update: (id, data) => api.put(`/places/${id}`, data),
  delete: (id) => api.delete(`/places/${id}`),
}

// Events
export const eventsAPI = {
  getAll: (params) => api.get('/events', { params }),
  create: (data) => api.post('/events', data),
  like: (id) => api.put(`/events/${id}/like`),
  delete: (id) => api.delete(`/events/${id}`),
}

// Reviews
export const reviewsAPI = {
  getByPlace: (placeId) => api.get(`/reviews/place/${placeId}`),
  create: (placeId, data) => api.post(`/reviews/place/${placeId}`, data),
  delete: (id) => api.delete(`/reviews/${id}`),
}

// Cities
export const citiesAPI = {
  getAll: () => api.get('/cities'),
  getOne: (id) => api.get(`/cities/${id}`),
}

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  savePlace: (placeId) => api.post(`/auth/save-place/${placeId}`),
}

// Chat
export const chatAPI = {
  send: (messages) => api.post('/chat', { messages }),
}

/** Rota: hem araç hem yürüyüş için backend üzerinden ORS/OSRM (İptal: `{ signal }`). */
export const directionsAPI = {
  route: (coordinates, profile, config = {}) =>
    api.post('/directions', { coordinates, profile }, config),
}

export default api
