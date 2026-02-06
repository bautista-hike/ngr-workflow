import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor para agregar el token de autenticación a todas las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('google_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface UserListResponse {
  superadmins: string[]
  authorized_users: string[]
  total_users: number
  total_superadmins: number
}

export const getUsers = async (): Promise<UserListResponse> => {
  const response = await api.get<UserListResponse>('/api/admin/users')
  return response.data
}

export const addUser = async (email: string): Promise<{ success: boolean; message: string; email: string }> => {
  const response = await api.post('/api/admin/users/add', { email })
  return response.data
}

export const removeUser = async (email: string): Promise<{ success: boolean; message: string; email: string }> => {
  const response = await api.post('/api/admin/users/remove', { email })
  return response.data
}
