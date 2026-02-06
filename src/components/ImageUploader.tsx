import { useRef, useState } from 'react'
import { processInvoice, saveInvoice } from '../api/invoiceApi'
import { MappedInvoiceData, ValidatedInvoiceData } from '../types'
import Modal from './Modal'

interface ErrorItem {
  file: File
  imageUrl: string
  data: MappedInvoiceData | null
  error: string
}

interface ImageUploaderProps {
  onDataExtracted: (data: MappedInvoiceData, imageUrl: string) => void
  onProcessingStart: () => void
  onReset: () => void
  onErrorQueue?: (errors: ErrorItem[]) => void
  isProcessing: boolean
}

export default function ImageUploader({
  onDataExtracted,
  onProcessingStart,
  onReset,
  onErrorQueue,
  isProcessing,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, processing: false })
  const [batchResults, setBatchResults] = useState<{ success: number; errors: number; errorsList: string[] }>({ success: 0, errors: 0, errorsList: [] })
  const [showBatchResultModal, setShowBatchResultModal] = useState(false)
  const [batchResultData, setBatchResultData] = useState<{ success: number; errors: number; errorsList: string[] } | null>(null)

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido')
      return
    }
    setSelectedFile(file)
    setIsBatchMode(false)
  }

  const handleFilesSelect = (files: FileList) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      alert('Por favor selecciona archivos de imagen válidos')
      return
    }
    
    if (imageFiles.length === 1) {
      setSelectedFile(imageFiles[0])
      setIsBatchMode(false)
    } else {
      setSelectedFiles(imageFiles)
      setIsBatchMode(true)
      setSelectedFile(null)
    }
  }

  const handleProcess = async () => {
    if (!selectedFile) return

    onProcessingStart()
    try {
      const data = await processInvoice(selectedFile)
      const imageUrl = URL.createObjectURL(selectedFile)
      onDataExtracted(data, imageUrl)
    } catch (error: any) {
      let errorMessage = 'Error desconocido'
      
      if (error.response) {
        const detail = error.response.data?.detail || error.response.data?.message
        if (typeof detail === 'string') {
          errorMessage = detail
        } else if (detail) {
          errorMessage = JSON.stringify(detail)
        } else {
          errorMessage = `Error ${error.response.status}: ${error.response.statusText}`
        }
      } else if (error.request) {
        errorMessage = 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.'
      } else {
        errorMessage = error.message || 'Error al procesar la factura'
      }
      
      console.error('Error completo:', error)
      alert(`Error al procesar la factura: ${errorMessage}`)
    }
  }

  const handleBatchProcess = async () => {
    if (selectedFiles.length === 0) return

    onProcessingStart()
    setBatchProgress({ current: 0, total: selectedFiles.length, processing: true })
    setBatchResults({ success: 0, errors: 0, errorsList: [] })

    let successCount = 0
    let errorCount = 0
    const errorsList: string[] = []
    const errorItems: ErrorItem[] = []

    // Procesar archivos secuencialmente
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      setBatchProgress({ current: i + 1, total: selectedFiles.length, processing: true })

      try {
        // Procesar la imagen
        const data = await processInvoice(file)

        // Validar campos requeridos
        if (!data.fecha || !data.canal) {
          errorCount++
          const errorMessage = `${file.name}: Faltan campos requeridos (fecha o canal)`
          errorsList.push(errorMessage)
          
          // Crear URL de la imagen para mostrar en el formulario
          const imageUrl = URL.createObjectURL(file)
          
          // Agregar a la cola de errores con los datos parciales obtenidos del procesamiento
          errorItems.push({
            file,
            imageUrl,
            data: data, // Datos parciales disponibles (el procesamiento fue exitoso pero faltan campos)
            error: errorMessage
          })
          continue
        }

        // Guardar automáticamente en BigQuery
        const validatedData: ValidatedInvoiceData = {
          ...data,
          fecha: data.fecha,
          canal: data.canal,
        }

        await saveInvoice(validatedData)
        successCount++
      } catch (error: any) {
        errorCount++
        const errorMessage = error.response?.data?.detail || error.message || 'Error desconocido'
        errorsList.push(`${file.name}: ${errorMessage}`)
        console.error(`Error procesando ${file.name}:`, error)
        
        // Crear URL de la imagen para mostrar en el formulario
        const imageUrl = URL.createObjectURL(file)
        
        // Crear datos vacíos para que el usuario los complete manualmente
        // Si el procesamiento falló, no tiene sentido intentar de nuevo
        const partialData: MappedInvoiceData = {
          id_caja: null,
          canal: null,
          codigo_tienda: null,
          tienda_nombre: null,
          fecha: null,
          hora: null,
          ticket_electronico: null,
          id_boleta: null,
          id_check: crypto.randomUUID(),
          monto_op_gravada: 0,
          importe_total: 0,
          recargo_consumo: 0,
          monto_tarifario: 0,
          mes: null,
          anio: null,
          momento: null,
          a_c: null,
        }
        
        // Agregar a la cola de errores
        errorItems.push({
          file,
          imageUrl,
          data: partialData,
          error: `${file.name}: ${errorMessage}`
        })
      }
    }

    setBatchProgress({ current: selectedFiles.length, total: selectedFiles.length, processing: false })
    setBatchResults({ success: successCount, errors: errorCount, errorsList })

    // Si hay errores y existe el callback, pasar la cola de errores al componente padre
    if (errorItems.length > 0 && onErrorQueue) {
      // Limpiar archivos seleccionados pero mantener el estado de batch
      setSelectedFiles([])
      setIsBatchMode(false)
      setBatchProgress({ current: 0, total: 0, processing: false })
      
      // Pasar los errores al componente padre para procesarlos secuencialmente
      onErrorQueue(errorItems)
    } else if (errorItems.length === 0) {
      // No hay errores, mostrar resumen de éxito
      setBatchResultData({ success: successCount, errors: errorCount, errorsList: [] })
      setShowBatchResultModal(true)
    } else {
      // Hay errores pero no hay callback, mostrar resumen tradicional
      setBatchResultData({ success: successCount, errors: errorCount, errorsList })
      setShowBatchResultModal(true)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files.length === 1) {
        handleFileSelect(e.dataTransfer.files[0])
      } else {
        handleFilesSelect(e.dataTransfer.files)
      }
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-800 p-6">
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive
            ? 'border-orange-500 bg-orange-950/20'
            : 'border-gray-700 hover:border-orange-600'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              if (e.target.files.length === 1) {
                handleFileSelect(e.target.files[0])
              } else {
                handleFilesSelect(e.target.files)
              }
            }
          }}
        />

        {!selectedFile && selectedFiles.length === 0 ? (
          <>
            <svg
              className="mx-auto h-12 w-12 text-orange-500 mb-4"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-white mb-2">
              Arrastra y suelta una o varias imágenes aquí
            </p>
            <p className="text-gray-400 text-sm mb-4">o</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors font-medium"
            >
              Seleccionar archivo(s)
            </button>
            <p className="text-gray-400 text-xs mt-2">
              Puedes seleccionar múltiples archivos para procesamiento automático
            </p>
            <div className="mt-4 bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-gray-300">
              <p className="font-medium text-white mb-1">💡 Recomendaciones:</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-300">
                <li><strong>Óptimo:</strong> 10-30 archivos (~3-9 minutos)</li>
                <li><strong>Aceptable:</strong> 30-50 archivos (~9-15 minutos)</li>
                <li><strong>Máximo recomendado:</strong> 50 archivos por lote</li>
              </ul>
            </div>
          </>
        ) : isBatchMode && selectedFiles.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <svg
                className="h-12 w-12 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-white font-medium text-lg">
              {selectedFiles.length} archivo(s) seleccionado(s)
            </p>
            
            {/* Información sobre tiempos estimados */}
            <div className="bg-orange-950/30 border border-orange-700 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-orange-200">
                  <p className="font-medium mb-1 text-white">Tiempo estimado de procesamiento:</p>
                  <p className="text-orange-300">
                    {selectedFiles.length <= 10 && `~${Math.ceil(selectedFiles.length * 0.3)} minutos (óptimo)`}
                    {selectedFiles.length > 10 && selectedFiles.length <= 30 && `~${Math.ceil(selectedFiles.length * 0.3)} minutos (recomendado)`}
                    {selectedFiles.length > 30 && selectedFiles.length <= 50 && `~${Math.ceil(selectedFiles.length * 0.3)} minutos (puede tardar)`}
                    {selectedFiles.length > 50 && `~${Math.ceil(selectedFiles.length * 0.3)} minutos (no recomendado - considere procesar en lotes más pequeños)`}
                  </p>
                  <p className="text-xs text-orange-400 mt-1">
                    Los archivos se procesan secuencialmente (uno por uno) para garantizar la calidad.
                  </p>
                </div>
              </div>
            </div>

            {/* Advertencia para muchos archivos */}
            {selectedFiles.length > 50 && (
              <div className="bg-yellow-950/30 border-2 border-yellow-600 rounded-lg p-3 text-sm">
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-yellow-200">
                    <p className="font-medium text-white">⚠️ Muchos archivos seleccionados</p>
                    <p className="text-yellow-300 text-xs mt-1">
                      Se recomienda procesar máximo 50 archivos a la vez para evitar timeouts. 
                      Considere dividir en lotes más pequeños.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-40 overflow-y-auto space-y-1 text-sm text-gray-300">
              {selectedFiles.slice(0, 10).map((file, index) => (
                <p key={index} className="truncate">
                  {index + 1}. {file.name}
                </p>
              ))}
              {selectedFiles.length > 10 && (
                <p className="text-gray-400">... y {selectedFiles.length - 10} más</p>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setSelectedFiles([])
                  setIsBatchMode(false)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
              >
                Cambiar archivos
              </button>
              <button
                onClick={handleBatchProcess}
                disabled={isProcessing || batchProgress.processing}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {batchProgress.processing 
                  ? `Procesando ${batchProgress.current} de ${batchProgress.total}...` 
                  : 'Procesar y Guardar Todos'}
              </button>
            </div>
          </div>
        ) : selectedFile ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <svg
                className="h-12 w-12 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-white font-medium">{selectedFile.name}</p>
            <p className="text-gray-400 text-sm">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setSelectedFile(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
              >
                Cambiar archivo
              </button>
              <button
                onClick={handleProcess}
                disabled={isProcessing}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isProcessing ? 'Procesando...' : 'Procesar Factura'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Progreso de procesamiento en lote */}
      {batchProgress.processing && batchProgress.total > 0 && (
        <div className="mt-6 space-y-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <p className="mt-2 text-white font-medium">
              Procesando {batchProgress.current} de {batchProgress.total}
            </p>
            <div className="mt-3 w-full bg-gray-800 rounded-full h-2.5">
              <div
                className="bg-orange-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="mt-2 text-sm text-gray-300">
              {batchProgress.current === batchProgress.total 
                ? 'Guardando en BigQuery...' 
                : 'Extrayendo datos y guardando automáticamente...'}
            </p>
          </div>
        </div>
      )}

      {/* Mensaje de éxito cuando termina el procesamiento */}
      {!batchProgress.processing && batchResults.success + batchResults.errors > 0 && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-orange-950/30 border-2 border-orange-500 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <svg className="h-8 w-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-3">
              ✅ Procesamiento Completado
            </h3>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-medium">Archivos procesados exitosamente:</span>
                  <span className="text-orange-500 font-bold text-lg">{batchResults.success}</span>
                </div>
                {batchResults.errors > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">Archivos con errores:</span>
                    <span className="text-red-500 font-bold text-lg">{batchResults.errors}</span>
                  </div>
                )}
                {batchResults.errorsList.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-gray-400 hover:text-white font-medium">
                      Ver detalles de errores
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs text-red-400 max-h-32 overflow-y-auto bg-red-950/30 p-2 rounded border border-red-800">
                      {batchResults.errorsList.map((error, index) => (
                        <li key={index} className="truncate">{error}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => {
                  // Limpiar estado local
                  setSelectedFiles([])
                  setIsBatchMode(false)
                  setSelectedFile(null)
                  setBatchProgress({ current: 0, total: 0, processing: false })
                  setBatchResults({ success: 0, errors: 0, errorsList: [] })
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                  // Resetear estado del componente padre
                  onReset()
                }}
                className="px-6 py-3 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Cargar Más Archivos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de procesamiento de archivo único */}
      {(isProcessing && !batchProgress.processing && selectedFile !== null && selectedFiles.length === 0 && batchResults.success === 0 && batchResults.errors === 0) && (
        <div className="mt-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          <p className="mt-2 text-white">Procesando imagen y extrayendo datos...</p>
        </div>
      )}

      {/* Modal de Resultados del Procesamiento Batch */}
      {batchResultData && (
        <Modal
          isOpen={showBatchResultModal}
          onClose={() => {
            setShowBatchResultModal(false)
            setBatchResultData(null)
            // Limpiar estado después de cerrar
            setSelectedFiles([])
            setIsBatchMode(false)
            setBatchProgress({ current: 0, total: 0, processing: false })
            setBatchResults({ success: 0, errors: 0, errorsList: [] })
          }}
          title="Procesamiento Completado"
          type={batchResultData.errors === 0 ? 'success' : 'warning'}
          confirmText="Aceptar"
        >
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-medium">Archivos procesados exitosamente:</span>
                  <span className="text-green-500 font-bold text-xl">{batchResultData.success}</span>
                </div>
                {batchResultData.errors > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">Archivos con errores:</span>
                    <span className="text-red-500 font-bold text-xl">{batchResultData.errors}</span>
                  </div>
                )}
              </div>
            </div>
            
            {batchResultData.errorsList.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 max-h-60 overflow-y-auto">
                <p className="text-gray-400 text-sm font-medium mb-2">Detalles de errores:</p>
                <ul className="space-y-1 text-sm">
                  {batchResultData.errorsList.slice(0, 10).map((error: string, index: number) => (
                    <li key={index} className="text-red-400">
                      • {error}
                    </li>
                  ))}
                  {batchResultData.errorsList.length > 10 && (
                    <li className="text-gray-500 italic">
                      ... y {batchResultData.errorsList.length - 10} más
                    </li>
                  )}
                </ul>
              </div>
            )}

            {batchResultData.errors > 0 && (
              <p className="text-sm text-yellow-300">
                ⚠️ Los archivos con errores se procesarán manualmente uno por uno.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
