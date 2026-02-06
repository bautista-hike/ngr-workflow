import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { saveInvoice } from '../api/invoiceApi'
import { MappedInvoiceData, ValidatedInvoiceData } from '../types'

interface StructuredDataItem {
  clave: string
  valor: string | number
}

interface ValidationFormProps {
  initialData: MappedInvoiceData
  invoiceImage: string | null
  onSaveSuccess: () => void
  onCancel: () => void
}

export default function ValidationForm({
  initialData,
  invoiceImage,
  onSaveSuccess,
  onCancel,
}: ValidationFormProps) {
  const defaultValues = {
    ...initialData,
    fecha: initialData.fecha || '', // Asegurar que fecha no sea null
    recargo_consumo: initialData.recargo_consumo != null ? Number(initialData.recargo_consumo) : 0,
    monto_tarifario: initialData.monto_tarifario != null ? Number(initialData.monto_tarifario) : 0,
    monto_op_gravada: initialData.monto_op_gravada != null ? Number(initialData.monto_op_gravada) : 0,
    importe_total: initialData.importe_total != null ? Number(initialData.importe_total) : 0,
    mes: initialData.mes != null ? Number(initialData.mes) : null,
    anio: initialData.anio != null ? Number(initialData.anio) : null,
    momento: initialData.momento || null,
  } as ValidatedInvoiceData

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ValidatedInvoiceData>({
    defaultValues,
  })

  const mutation = useMutation({
    mutationFn: saveInvoice,
    onSuccess: () => {
      alert('Factura guardada exitosamente en BigQuery')
      onSaveSuccess()
    },
    onError: (error: unknown) => {
      const errorMessage = 
        (error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
        (error as { message?: string })?.message ||
        'Error desconocido'
      alert(`Error al guardar la factura: ${errorMessage}`)
    },
  })

  const onSubmit = (data: ValidatedInvoiceData) => {
    // Asegurar que fecha esté presente
    if (!data.fecha) {
      alert('El campo fecha es requerido')
      return
    }
    mutation.mutate(data)
  }

  return (
    <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-800 p-6">
      <h2 className="text-2xl font-bold text-white mb-6">
        Datos Extraídos - Por favor valida y corrige si es necesario
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

      {/* Mostrar datos estructurados extraídos */}
      {initialData.raw_extracted_text && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-white mb-3">
            📄 Datos Extraídos por n8n:
          </h3>
          {(() => {
            try {
              // Intentar parsear como JSON estructurado
              const parsed = JSON.parse(initialData.raw_extracted_text);
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].clave && parsed[0].valor) {
                // Formato estructurado: mostrar como tabla
                return (
                  <div className="bg-gray-900 p-3 rounded border border-gray-700 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-3 font-semibold text-white">Campo</th>
                          <th className="text-left py-2 px-3 font-semibold text-white">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(parsed as StructuredDataItem[]).map((item, index) => (
                          <tr key={index} className="border-b border-gray-800">
                            <td className="py-2 px-3 text-gray-400 font-medium capitalize">
                              {item.clave?.replace(/_/g, ' ')}
                            </td>
                            <td className="py-2 px-3 text-white">
                              {typeof item.valor === 'number' 
                                ? item.valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : String(item.valor)
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
            } catch (e) {
              // No es JSON válido, mostrar como texto
            }
            // Mostrar como texto crudo
            return (
              <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words max-h-48 overflow-y-auto font-mono bg-gray-900 p-3 rounded border border-gray-700">
                {initialData.raw_extracted_text}
              </pre>
            );
          })()}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* id_caja */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              ID Caja
            </label>
            <input
              type="text"
              {...register('id_caja')}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* canal */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Canal <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('canal', { required: 'El canal es requerido' })}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            {errors.canal && (
              <p className="mt-1 text-sm text-red-400">{errors.canal.message}</p>
            )}
          </div>

          {/* codigo_tienda */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Código Tienda
            </label>
            <input
              type="text"
              {...register('codigo_tienda')}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* tienda_nombre */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Nombre del Comercio
            </label>
            <input
              type="text"
              {...register('tienda_nombre')}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* fecha */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('fecha', { required: 'La fecha es requerida' })}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            {errors.fecha && (
              <p className="mt-1 text-sm text-red-600">{errors.fecha.message}</p>
            )}
          </div>

          {/* hora */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Hora
            </label>
            <input
              type="time"
              step="1"
              {...register('hora')}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* ticket_electronico */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Ticket Electrónico (CAE)
            </label>
            <input
              type="text"
              {...register('ticket_electronico')}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* id_boleta */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              ID Boleta
            </label>
            <input
              type="text"
              {...register('id_boleta')}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* monto_op_gravada */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Monto Operación Gravada
            </label>
            <input
              type="number"
              step="0.01"
              {...register('monto_op_gravada', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* importe_total */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Importe Total
            </label>
            <input
              type="number"
              step="0.01"
              {...register('importe_total', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* recargo_consumo */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Recargo Consumo
            </label>
            <input
              type="number"
              step="0.01"
              {...register('recargo_consumo', { 
                valueAsNumber: true,
                setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0
              })}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* monto_tarifario */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Monto Tarifario
            </label>
            <input
              type="number"
              step="0.01"
              {...register('monto_tarifario', { 
                valueAsNumber: true,
                setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0
              })}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* mes - solo lectura */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Mes (derivado)
            </label>
            <input
              type="number"
              {...register('mes', { valueAsNumber: true })}
              readOnly
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* anio - solo lectura */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Año (derivado)
            </label>
            <input
              type="number"
              {...register('anio', { valueAsNumber: true })}
              readOnly
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* momento - solo lectura */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-white mb-1">
              Momento (derivado)
            </label>
            <input
              type="text"
              {...register('momento')}
              readOnly
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* a_c */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              A/C
            </label>
            <input
              type="text"
              {...register('a_c')}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* id_check - hidden pero necesario */}
        <input type="hidden" {...register('id_check')} />

        {/* Botones de acción */}
        <div className="flex gap-4 justify-end pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {mutation.isPending ? 'Guardando...' : 'Confirmar y Guardar'}
          </button>
        </div>
      </form>

      {mutation.isPending && (
        <div className="mt-4 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
          <p className="mt-2 text-white">Guardando en BigQuery...</p>
        </div>
      )}
    </div>
  )
}
