# Plataforma de Procesamiento y Validación de Facturas

Sistema completo para procesar facturas mediante OCR, validar datos y almacenarlos en Google BigQuery.

## Arquitectura

- **Frontend**: React + TypeScript + Vite + TanStack Query + Tailwind CSS + React Hook Form
- **Backend**: FastAPI (Python)
- **Servicio de Extracción**: n8n workflow (externo)

## Instalación

### Backend

1. Crear entorno virtual:
```bash
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

2. Instalar dependencias:
```bash
pip install -r requirements.txt
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

4. Ejecutar el servidor:
```bash
python app.py
```

El backend estará disponible en `http://localhost:8000` (puerto por defecto)

**Nota**: Si el puerto 8000 está ocupado, puedes:
- Cambiar el puerto: `python app.py 5001` (o cualquier otro puerto)
- O configurar la variable de entorno: `PORT=5001 python app.py`

### Frontend

1. Instalar dependencias:
```bash
npm install
```

2. Ejecutar en modo desarrollo:
```bash
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## Configuración

### Variables de Entorno (.env)

- `N8N_WEBHOOK_URL`: URL del webhook de n8n para extracción de texto
- `GOOGLE_APPLICATION_CREDENTIALS`: Ruta al archivo JSON de credenciales de Google Cloud
- `BIGQUERY_PROJECT_ID`: ID del proyecto de Google Cloud
- `BIGQUERY_DATASET_ID`: ID del dataset en BigQuery
- `BIGQUERY_TABLE_ID`: ID de la tabla en BigQuery

### Esquema de BigQuery

La tabla debe tener el siguiente esquema:

- `id_caja` (STRING)
- `canal` (STRING)
- `codigo_tienda` (STRING)
- `tienda_nombre` (STRING)
- `fecha` (DATE)
- `hora` (TIME)
- `ticket_electronico` (STRING)
- `id_boleta` (STRING)
- `id_check` (STRING)
- `monto_op_gravada` (FLOAT64)
- `importe_total` (FLOAT64)
- `recargo_consumo` (FLOAT64)
- `monto_tarifario` (FLOAT64)
- `mes` (INTEGER)
- `anio` (INTEGER)
- `momento` (DATETIME)
- `a_c` (STRING)

**Nota**: Puedes usar el archivo `bigquery_schema.sql` para crear la tabla. Edita el archivo con tus IDs de proyecto y dataset, luego ejecútalo en Google Cloud Console o usando el comando `bq`.

## Uso

1. Abre el frontend en el navegador
2. Arrastra o selecciona una imagen de factura
3. Haz clic en "Procesar Factura"
4. Revisa y corrige los datos extraídos en el formulario
5. Completa el campo "Canal" (requerido)
6. Haz clic en "Confirmar y Guardar"

Los datos se guardarán automáticamente en BigQuery.
