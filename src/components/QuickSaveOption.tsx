import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { saveInvoice } from '../api/invoiceApi'
import { MappedInvoiceData, ValidatedInvoiceData } from '../types'
import Modal from './Modal'

interface QuickSaveOptionProps {
  data: MappedInvoiceData
  invoiceImage: string | null
  onSaveSuccess: () => void
  onReview: () => void
}

export default function QuickSaveOption({
  data,
  invoiceImage,
  onSaveSuccess,
  onReview,
}: QuickSaveOptionProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const mutation = useMutation({
    mutationFn: saveInvoice,
    onSuccess: () => {
      setShowConfirmModal(false)
      setShowSuccessModal(true)
    },
    onError: (error: unknown) => {
      const errorMsg =
        (error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (error as { message?: string })?.message ||
        'Error desconocido'
      setErrorMessage(errorMsg)
      setShowConfirmModal(false)
      setShowErrorModal(true)
    },
  })

  const handleQuickSave = () => {
    // Validar que los campos requeridos estén presentes
    if (!data.fecha) {
      setErrorMessage('El campo "fecha" es requerido. Por favor, revisa y edita los datos.')
      setShowErrorModal(true)
      return
    }

    if (!data.canal) {
      setErrorMessage('El campo "canal" es requerido. Por favor, revisa y edita los datos.')
      setShowErrorModal(true)
      return
    }

    // Mostrar modal de confirmación
    setShowConfirmModal(true)
  }

  const handleConfirmSave = () => {
    // Convertir MappedInvoiceData a ValidatedInvoiceData
    const validatedData: ValidatedInvoiceData = {
      ...data,
      fecha: data.fecha!, // Ya validamos que existe
      canal: data.canal!, // Ya validamos que existe
    }

    mutation.mutate(validatedData)
  }

  return (
    <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-800 p-6">
      <h2 className="text-2xl font-bold text-white mb-6">
        Datos Extraídos Exitosamente
      </h2>

      {/* Mostrar imagen de la factura */}
      {invoiceImage && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">
            📷 Imagen de la Factura:
          </h3>
          <div className="flex justify-center">
            <img
              src={invoiceImage}
              alt="Factura procesada"
              className="max-w-full max-h-96 rounded-lg shadow-md border border-gray-600 object-contain"
            />
          </div>
        </div>
      )}

      {/* Resumen de datos extraídos */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">
          Resumen de Datos Extraídos:
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-medium text-gray-400">Competidor:</span>{' '}
            <span className="text-white">{data.tienda_nombre || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-400">Local:</span>{' '}
            <span className="text-white">{data.codigo_tienda || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-400">Fecha:</span>{' '}
            <span className="text-white">{data.fecha || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-400">Hora:</span>{' '}
            <span className="text-white">{data.hora || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-400">Importe Total:</span>{' '}
            <span className="text-orange-500 font-semibold">
              ${data.importe_total.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-400">Número de Ticket:</span>{' '}
            <span className="text-white">{data.id_boleta || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Opciones de acción */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <button
          onClick={onReview}
          className="px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors font-medium border border-gray-700"
        >
          📝 Revisar y Editar
        </button>
        <button
          onClick={handleQuickSave}
          disabled={mutation.isPending || !data.fecha || !data.canal}
          className="px-6 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Guardando...
            </>
          ) : (
            <>
              ✅ Guardar Directamente
            </>
          )}
        </button>
      </div>

      {/* Advertencia si faltan campos requeridos */}
      {(!data.fecha || !data.canal) && (
        <div className="mt-4 p-3 bg-yellow-950/30 border border-yellow-600 rounded-md">
          <p className="text-sm text-yellow-300">
            ⚠️ <strong>Nota:</strong> Para guardar directamente, los campos "fecha" y "canal" son requeridos.
            {!data.fecha && ' Falta el campo "fecha".'}
            {!data.canal && ' Falta el campo "canal".'}
            {' '}Por favor, usa "Revisar y Editar" para completarlos.
          </p>
        </div>
      )}

      {/* Modal de Confirmación */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirmar Guardado"
        type="confirm"
        onConfirm={handleConfirmSave}
        confirmText="Sí, Guardar"
        cancelText="Cancelar"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            ¿Estás seguro de que quieres guardar estos datos directamente sin revisar?
          </p>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Competidor:</span>
                <span className="text-white font-medium">{data.tienda_nombre || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fecha:</span>
                <span className="text-white font-medium">{data.fecha || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Importe Total:</span>
                <span className="text-orange-500 font-semibold">
                  ${data.importe_total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-400 italic">
            Esta acción guardará los datos tal como fueron extraídos.
          </p>
        </div>
      </Modal>

      {/* Modal de Éxito */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false)
          onSaveSuccess()
        }}
        title="¡Guardado Exitoso!"
        type="success"
        confirmText="Aceptar"
      >
        <p className="text-gray-300">
          La factura ha sido guardada exitosamente en BigQuery.
        </p>
      </Modal>

      {/* Modal de Error */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error al Guardar"
        type="error"
        confirmText="Aceptar"
      >
        <p className="text-gray-300">{errorMessage}</p>
      </Modal>
    </div>
  )
}
