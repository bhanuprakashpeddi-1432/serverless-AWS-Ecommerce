import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - could redirect to login
      localStorage.removeItem('accessToken')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Products API
export const productsApi = {
  getAll: () => api.get('/products'),
  getProducts: (pageSize = 20, lastKey = null) => {
    const params = { limit: pageSize }
    if (lastKey) {
      params.lastKey = lastKey
    }
    return api.get('/products', { params })
  },
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getPresignedUploadUrl: (data) => api.post('/products/upload-url', data),
}

// Cart API
export const cartApi = {
  get: () => api.get('/cart'),
  addItem: (data) => api.post('/cart', data),
  updateItem: (productId, data) => api.put(`/cart/${productId}`, data),
  removeItem: (productId) => api.delete(`/cart/${productId}`),
  clear: () => api.delete('/cart'),
}

// Orders API
export const ordersApi = {
  getAll: () => api.get('/orders'),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/checkout', data),
}

export default api
