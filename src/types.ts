export interface MappedInvoiceData {
  id_caja: string | null
  canal: string | null
  codigo_tienda: string | null
  tienda_nombre: string | null
  fecha: string | null
  hora: string | null
  ticket_electronico: string | null
  id_boleta: string | null
  id_check: string
  monto_op_gravada: number
  importe_total: number
  recargo_consumo: number
  monto_tarifario: number
  mes: number | null
  anio: number | null
  momento: string | null
  a_c: string | null
  raw_extracted_text?: string // Texto crudo extraído por OCR
}

export interface ValidatedInvoiceData extends MappedInvoiceData {
  fecha: string // Requerido en validación
}
