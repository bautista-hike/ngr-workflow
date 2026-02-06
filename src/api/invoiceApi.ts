import axios from 'axios'
import { MappedInvoiceData, ValidatedInvoiceData } from '../types'

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

export const processInvoice = async (file: File): Promise<MappedInvoiceData> => {
  const formData = new FormData()
  formData.append('invoice_image', file)

  const token = localStorage.getItem('google_token')
  const headers: Record<string, string> = {
    'Content-Type': 'multipart/form-data',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await api.post<MappedInvoiceData>('/api/process-invoice', formData, {
    headers,
  })

  return response.data
}

export const saveInvoice = async (data: ValidatedInvoiceData): Promise<{ success: boolean; id_check: string; message: string }> => {
  const response = await api.post('/api/save-invoice', data)
  return response.data
}
