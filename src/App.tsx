import { useState, useEffect } from 'react'
import ProtectedRoute from './components/ProtectedRoute'
import Header from './components/Header'
import ImageUploader from './components/ImageUploader'
import ValidationForm from './components/ValidationForm'
import QuickSaveOption from './components/QuickSaveOption'
import { MappedInvoiceData } from './types'

interface ErrorItem {
  file: File
  imageUrl: string
  data: MappedInvoiceData | null
  error: string
}

function App() {
  const [invoiceData, setInvoiceData] = useState<MappedInvoiceData | null>(null)
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null) // URL de la imagen
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [errorQueue, setErrorQueue] = useState<ErrorItem[]>([]) // Cola de errores para procesar
  const [currentErrorIndex, setCurrentErrorIndex] = useState<number>(-1) // Índice del error actual

  const handleDataExtracted = (data: MappedInvoiceData, imageUrl: string) => {
    setInvoiceData(data)
    setInvoiceImage(imageUrl)
    setIsProcessing(false)
    setShowReviewForm(false) // Mostrar opción rápida primero
  }

  const handleProcessingStart = () => {
    setIsProcessing(true)
    setInvoiceData(null)
    setInvoiceImage(null)
    setShowReviewForm(false)
  }

  const handleSaveSuccess = () => {
    // Limpiar URL del objeto para evitar memory leaks
    if (invoiceImage && invoiceImage.startsWith('blob:')) {
      URL.revokeObjectURL(invoiceImage)
    }
    
    // Si estamos procesando errores de la cola, pasar al siguiente
    if (currentErrorIndex >= 0 && currentErrorIndex < errorQueue.length) {
      const nextIndex = currentErrorIndex + 1
      if (nextIndex < errorQueue.length) {
        // Hay más errores, mostrar el siguiente
        const nextError = errorQueue[nextIndex]
        setInvoiceData(nextError.data)
        setInvoiceImage(nextError.imageUrl)
        setShowReviewForm(true) // Mostrar formulario de edición directamente
        setCurrentErrorIndex(nextIndex)
        setIsProcessing(false)
      } else {
        // No hay más errores, limpiar todo
        errorQueue.forEach(item => {
          if (item.imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(item.imageUrl)
          }
        })
        setErrorQueue([])
        setCurrentErrorIndex(-1)
        setInvoiceData(null)
        setInvoiceImage(null)
        setIsProcessing(false)
        setShowReviewForm(false)
      }
    } else {
      // Procesamiento normal (no batch con errores)
      setInvoiceData(null)
      setInvoiceImage(null)
      setIsProcessing(false)
      setShowReviewForm(false)
    }
  }
  
  const handleErrorQueue = (errors: ErrorItem[]) => {
    // Cuando hay errores en batch, agregarlos a la cola y mostrar el primero
    if (errors.length > 0) {
      setErrorQueue(errors)
      const firstError = errors[0]
      setInvoiceData(firstError.data)
      setInvoiceImage(firstError.imageUrl)
      setShowReviewForm(true) // Mostrar formulario de edición directamente
      setCurrentErrorIndex(0)
      setIsProcessing(false)
    }
  }

  const handleReview = () => {
    setShowReviewForm(true)
  }
  
  const handleCancelError = () => {
    // Si estamos en la cola de errores, pasar al siguiente o cancelar todo
    if (currentErrorIndex >= 0) {
      const nextIndex = currentErrorIndex + 1
      if (nextIndex < errorQueue.length) {
        const nextError = errorQueue[nextIndex]
        setInvoiceData(nextError.data)
        setInvoiceImage(nextError.imageUrl)
        setCurrentErrorIndex(nextIndex)
      } else {
        // Limpiar cola de errores
        errorQueue.forEach(item => {
          if (item.imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(item.imageUrl)
          }
        })
        setErrorQueue([])
        setCurrentErrorIndex(-1)
        setInvoiceData(null)
        setInvoiceImage(null)
        setShowReviewForm(false)
      }
    } else {
      setShowReviewForm(false)
    }
  }

  const handleReset = () => {
    // Limpiar URL del objeto para evitar memory leaks
    if (invoiceImage && invoiceImage.startsWith('blob:')) {
      URL.revokeObjectURL(invoiceImage)
    }
    
    // Limpiar cola de errores si existe
    errorQueue.forEach(item => {
      if (item.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.imageUrl)
      }
    })
    
    setInvoiceData(null)
    setInvoiceImage(null)
    setIsProcessing(false)
    setShowReviewForm(false)
    setErrorQueue([])
    setCurrentErrorIndex(-1)
  }

  // Limpiar URL del objeto cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (invoiceImage && invoiceImage.startsWith('blob:')) {
        URL.revokeObjectURL(invoiceImage)
      }
    }
  }, [invoiceImage])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {!invoiceData && currentErrorIndex === -1 ? (
            <ImageUploader
              onDataExtracted={handleDataExtracted}
              onProcessingStart={handleProcessingStart}
              onReset={handleReset}
              onErrorQueue={handleErrorQueue}
              isProcessing={isProcessing}
            />
          ) : showReviewForm || currentErrorIndex >= 0 ? (
            <div>
              {currentErrorIndex >= 0 && errorQueue.length > 0 && (
                <div className="mb-4 p-4 bg-yellow-900 border-2 border-yellow-700 rounded-lg">
                  <p className="text-yellow-300 font-semibold">
                    ⚠️ Error en procesamiento automático ({currentErrorIndex + 1} de {errorQueue.length})
                  </p>
                  <p className="text-yellow-200 text-sm mt-1">
                    Archivo: {errorQueue[currentErrorIndex].file.name}
                  </p>
                  <p className="text-yellow-200 text-sm">
                    Error: {errorQueue[currentErrorIndex].error}
                  </p>
                  <p className="text-yellow-300 text-sm mt-2">
                    Por favor, completa los campos manualmente:
                  </p>
                </div>
              )}
              <ValidationForm
                initialData={invoiceData!}
                invoiceImage={invoiceImage}
                onSaveSuccess={handleSaveSuccess}
                onCancel={handleCancelError}
              />
            </div>
          ) : (
            <QuickSaveOption
              data={invoiceData!}
              invoiceImage={invoiceImage}
              onSaveSuccess={handleSaveSuccess}
              onReview={handleReview}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default App
