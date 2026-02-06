# Documentación Completa del Sistema de Procesamiento de Facturas

## 📋 Índice

1. [Arquitectura General](#arquitectura-general)
2. [Flujo de Usuario Completo](#flujo-de-usuario-completo)
3. [Comunicación con n8n](#comunicación-con-n8n)
4. [Procesamiento de Datos](#procesamiento-de-datos)
5. [Procesamiento en Lote (Batch)](#procesamiento-en-lote-batch)
6. [Manejo de Errores](#manejo-de-errores)
7. [Autenticación y Autorización](#autenticación-y-autorización)
8. [Guardado en BigQuery](#guardado-en-bigquery)
9. [Esquema de Datos](#esquema-de-datos)

---

## 🏗️ Arquitectura General

El sistema está compuesto por tres componentes principales:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Frontend  │ ──────> │   Backend   │ ──────> │     n8n    │
│   (React)   │         │  (FastAPI)  │         │  (OCR/IA)  │
└─────────────┘         └─────────────┘         └─────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │  BigQuery   │
                        │  (Storage)  │
                        └─────────────┘
```

### Componentes:

- **Frontend (React + TypeScript)**: Interfaz de usuario para subir facturas, revisar datos y guardar
- **Backend (FastAPI)**: API REST que procesa imágenes, se comunica con n8n y guarda en BigQuery
- **n8n**: Servicio externo que realiza OCR y extracción de datos usando IA
- **BigQuery**: Base de datos en la nube donde se almacenan las facturas procesadas

---

## 👤 Flujo de Usuario Completo

### 1. Autenticación

1. Usuario accede a la aplicación
2. Se muestra pantalla de login con botón "Continuar con Google"
3. Usuario hace clic y se autentica con Google OAuth
4. El frontend envía el token de Google al backend (`/api/verify-user`)
5. El backend verifica:
   - Que el token sea válido (llamando a Google API)
   - Que el email esté en la lista de usuarios autorizados (`authorized_users.json`)
   - Si es superadmin, se marca como tal
6. Si está autorizado, se permite el acceso a la aplicación

### 2. Subida de Factura (Archivo Único)

1. Usuario selecciona una imagen de factura (drag & drop o click)
2. Usuario hace clic en "Procesar Factura"
3. El frontend muestra spinner de "Procesando imagen y extrayendo datos..."
4. El frontend envía la imagen al backend (`POST /api/process-invoice`)
5. El backend procesa la imagen (ver sección [Comunicación con n8n](#comunicación-con-n8n))
6. El backend retorna los datos extraídos
7. El frontend muestra dos opciones:
   - **"Guardar Directamente"**: Si tiene fecha y canal, guarda sin revisar
   - **"Revisar y Editar"**: Muestra formulario para validar/corregir datos

### 3. Revisión y Edición

1. Usuario hace clic en "Revisar y Editar"
2. Se muestra:
   - **Imagen de la factura**: Para comparar visualmente
   - **Datos extraídos por n8n**: Tabla con los campos clave-valor
   - **Formulario editable**: Todos los campos pueden ser modificados
3. Usuario corrige/completa los campos necesarios
4. Usuario hace clic en "Confirmar y Guardar"
5. Los datos se envían al backend (`POST /api/save-invoice`)
6. El backend valida y guarda en BigQuery
7. Se muestra mensaje de éxito y se limpia el formulario

### 4. Guardado Directo

1. Si la factura tiene `fecha` y `canal` completos
2. Usuario hace clic en "Guardar Directamente"
3. Los datos se envían directamente a BigQuery sin revisión
4. Se muestra mensaje de éxito

---

## 🔄 Comunicación con n8n

### Qué se Envía a n8n

**Endpoint**: `POST {N8N_WEBHOOK_URL}`

**Formato**: `multipart/form-data`

**Datos enviados**:
```javascript
{
  invoice_image: File  // Archivo de imagen (JPG, PNG, etc.)
}
```

**Headers**:
- `Content-Type: multipart/form-data`
- `Authorization: Bearer {token}` (si aplica)

**Ejemplo de request**:
```python
files = {
    'invoice_image': (
        'factura.jpg',           # Nombre del archivo
        file_content,             # Contenido binario de la imagen
        'image/jpeg'             # Content-Type
    )
}

response = requests.post(
    N8N_WEBHOOK_URL,
    files=files,
    timeout=60  # Timeout configurable
)
```

### Qué Viene de n8n

n8n retorna un JSON con los datos extraídos de la factura. El sistema soporta múltiples formatos:

#### Formato 1: Array con objeto "data" (Recomendado)

```json
[
  {
    "data": [
      {
        "clave": "competidor",
        "valor": "KENTUCKY FRIED CHICKEN"
      },
      {
        "clave": "local",
        "valor": "KFC03- AVIACION"
      },
      {
        "clave": "canal_de_venta",
        "valor": "Salon"
      },
      {
        "clave": "importe_total",
        "valor": 3.5
      },
      {
        "clave": "numero_de_ticket",
        "valor": "20250528-01-000356630"
      },
      {
        "clave": "fecha",
        "valor": "2025-05-28"
      },
      {
        "clave": "hora",
        "valor": "19:21:11"
      },
      {
        "clave": "recargo_consumo",
        "valor": 0.17
      },
      {
        "clave": "monto_tarifario",
        "valor": 0
      }
    ]
  }
]
```

#### Formato 2: Array directo de objetos clave-valor

```json
[
  {
    "clave": "competidor",
    "valor": "KENTUCKY FRIED CHICKEN"
  },
  {
    "clave": "fecha",
    "valor": "2025-05-28"
  }
]
```

#### Formato 3: Objeto con array en alguna key

```json
{
  "resultados": [
    {
      "clave": "competidor",
      "valor": "KENTUCKY FRIED CHICKEN"
    }
  ]
}
```

### Campos Esperados de n8n

El sistema espera los siguientes campos (todos opcionales):

- `competidor` → Se mapea a `tienda_nombre`
- `local` → Se mapea a `codigo_tienda`
- `canal_de_venta` → Se mapea a `canal`
- `importe_total` → Se mapea a `importe_total`
- `numero_de_ticket` → Se mapea a `id_boleta`
- `fecha` → Se mapea a `fecha` (formato: YYYY-MM-DD o DD/MM/YYYY)
- `hora` → Se mapea a `hora` (formato: HH:MM:SS)
- `recargo_consumo` → Se mapea a `recargo_consumo` (número)
- `monto_tarifario` → Se mapea a `monto_tarifario` (número)
- `id_caja` → Se mapea a `id_caja`
- `a_c` → Se mapea a `a_c`

---

## ⚙️ Procesamiento de Datos

### Paso 1: Recepción de Respuesta de n8n

El backend recibe la respuesta de n8n y detecta automáticamente el formato:

```python
# Detectar formato
if isinstance(response_data, list) and len(response_data) > 0:
    if 'data' in response_data[0]:
        structured_array = response_data[0]['data']
    elif 'clave' in response_data[0]:
        structured_array = response_data
```

### Paso 2: Parseo de Datos Estructurados

Se llama a `parse_structured_data()` que:

1. **Convierte array a diccionario**: Transforma `[{"clave": "x", "valor": "y"}]` a `{"x": "y"}`
2. **Normaliza claves**: Convierte todas las claves a minúsculas
3. **Mapea campos**: Convierte nombres de n8n a nombres de BigQuery
4. **Deriva campos**: Calcula campos derivados como `mes`, `anio`, `momento`

### Paso 3: Mapeo de Campos

```python
# Ejemplos de mapeo:
"competidor" → "tienda_nombre"
"canal_de_venta" → "canal"
"numero_de_ticket" → "id_boleta"
"importe_total" → "importe_total"
```

### Paso 4: Cálculo de Campos Derivados

#### `mes` y `anio`
- Se extraen de `fecha` si está disponible
- Formato esperado: `YYYY-MM-DD`

#### `momento`
- Se construye combinando `fecha` y `hora`
- Formato: `YYYY-MM-DDTHH:MM:SS`
- Si no hay hora, se usa `00:00:00`

#### `id_check`
- Se genera un UUID único para cada factura
- Formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

#### `monto_op_gravada`
- Por defecto igual a `importe_total`
- Puede ser modificado manualmente en el formulario

### Paso 5: Validación y Retorno

El backend valida que los datos estén en el formato correcto y retorna:

```json
{
  "id_caja": "0012",
  "canal": "Salon",
  "codigo_tienda": "KFC03",
  "tienda_nombre": "KENTUCKY FRIED CHICKEN",
  "fecha": "2025-05-28",
  "hora": "19:21:11",
  "ticket_electronico": null,
  "id_boleta": "20250528-01-000356630",
  "id_check": "95e86689-9f57-42bd-8a7f-8a47a0390cb4",
  "monto_op_gravada": 3.5,
  "importe_total": 3.5,
  "recargo_consumo": 0.17,
  "monto_tarifario": 0.0,
  "mes": 5,
  "anio": 2025,
  "momento": "2025-05-28T19:21:11",
  "a_c": null,
  "raw_extracted_text": "[{\"clave\":\"competidor\",\"valor\":\"KENTUCKY FRIED CHICKEN\"},...]"
}
```

---

## 📦 Procesamiento en Lote (Batch)

### Flujo de Procesamiento Batch

1. **Selección múltiple**: Usuario selecciona múltiples archivos (2 o más)
2. **Inicio de procesamiento**: Se muestra barra de progreso
3. **Procesamiento secuencial**: Cada archivo se procesa uno por uno:
   ```
   Archivo 1 → Procesar → Validar → Guardar
   Archivo 2 → Procesar → Validar → Guardar
   Archivo 3 → Procesar → Validar → Guardar
   ...
   ```
4. **Barra de progreso**: Muestra "Procesando X de Y archivos"
5. **Resultados**: Al finalizar se muestra:
   - ✅ Exitosos: N
   - ❌ Errores: M

### Manejo de Errores en Batch

Si hay errores durante el procesamiento batch:

1. **Errores capturados**: Se guardan en una cola de errores
2. **Procesamiento secuencial de errores**: 
   - Se muestra el primer error con su imagen
   - Usuario completa los campos manualmente
   - Al guardar, automáticamente pasa al siguiente error
   - Se repite hasta completar todos los errores
3. **Indicador de progreso**: Muestra "Error en procesamiento automático (1 de 3)"
4. **Datos disponibles**: 
   - Si el procesamiento fue exitoso pero faltan campos → muestra datos parciales
   - Si el procesamiento falló → muestra campos vacíos para completar

### Ejemplo de Flujo con Errores

```
1. Usuario sube 5 archivos
2. Procesamiento:
   - Archivo 1: ✅ Guardado exitosamente
   - Archivo 2: ❌ Error: Faltan campos requeridos
   - Archivo 3: ✅ Guardado exitosamente
   - Archivo 4: ❌ Error: Timeout en n8n
   - Archivo 5: ✅ Guardado exitosamente

3. Resultado:
   - ✅ Exitosos: 3
   - ❌ Errores: 2

4. Procesamiento de errores:
   - Muestra Archivo 2 con datos parciales → Usuario completa → Guarda
   - Muestra Archivo 4 con campos vacíos → Usuario completa → Guarda
```

---

## 🚨 Manejo de Errores

### Tipos de Errores

#### 1. Error de Autenticación
- **Causa**: Token inválido o usuario no autorizado
- **Acción**: Redirigir a login

#### 2. Error de Procesamiento (n8n)
- **Causas posibles**:
  - Timeout (n8n tarda más de 60 segundos)
  - Error de conexión con n8n
  - n8n retorna error HTTP
- **Acción**: Mostrar formulario de edición manual con campos vacíos

#### 3. Error de Validación
- **Causas posibles**:
  - Faltan campos requeridos (`fecha` o `canal`)
  - Formato de fecha/hora inválido
- **Acción**: Mostrar formulario de edición con datos parciales

#### 4. Error de Guardado (BigQuery)
- **Causas posibles**:
  - Error de conexión con BigQuery
  - Esquema incorrecto
  - Datos inválidos
- **Acción**: Mostrar error y permitir reintentar

### Optimizaciones para Errores de n8n

El sistema incluye varias optimizaciones para manejar errores de n8n:

1. **Connection Pooling**: Reutiliza conexiones HTTP
2. **Retry Logic**: Reintenta automáticamente hasta 3 veces con backoff exponencial
3. **Timeout Configurable**: Por defecto 60 segundos (configurable vía `N8N_TIMEOUT`)
4. **Manejo de Errores HTTP**: Detecta códigos 429, 500, 502, 503, 504 y reintenta

---

## 🔐 Autenticación y Autorización

### Flujo de Autenticación

1. **Login con Google OAuth**:
   - Usuario hace clic en "Continuar con Google"
   - Se abre ventana de Google OAuth
   - Usuario autoriza la aplicación
   - Google retorna un `access_token`

2. **Verificación en Backend**:
   ```python
   # Frontend envía token a backend
   POST /api/verify-user
   {
     "email": "usuario@ejemplo.com",
     "token": "ya29.A0AUMWg_..."
   }
   
   # Backend verifica con Google API
   GET https://www.googleapis.com/oauth2/v2/userinfo
   Headers: Authorization: Bearer {token}
   
   # Backend verifica autorización
   if email in authorized_emails:
       return {"authorized": True, "is_superadmin": False}
   ```

3. **Almacenamiento**:
   - Token se guarda en `localStorage` como `google_token`
   - Datos del usuario se guardan en `localStorage` como `user_data`

### Autorización

El sistema usa un archivo `authorized_users.json`:

```json
{
  "superadmin_emails": [
    "darts@abndigital.com.ar"
  ],
  "authorized_emails": [
    "usuario1@ejemplo.com",
    "usuario2@ejemplo.com"
  ]
}
```

- **Usuarios autorizados**: Pueden acceder y procesar facturas
- **Superadmins**: Pueden además gestionar usuarios (agregar/eliminar)

### Endpoints Protegidos

Todos los endpoints requieren autenticación excepto:
- `GET /docs` (documentación de API)
- `GET /` (raíz)

Endpoints protegidos:
- `POST /api/process-invoice`: Requiere token válido
- `POST /api/save-invoice`: Requiere token válido
- `POST /api/admin/users`: Requiere ser superadmin
- `POST /api/admin/users/add`: Requiere ser superadmin
- `POST /api/admin/users/remove`: Requiere ser superadmin

---

## 💾 Guardado en BigQuery

### Endpoint de Guardado

**Endpoint**: `POST /api/save-invoice`

**Body**:
```json
{
  "id_caja": "0012",
  "canal": "Salon",
  "codigo_tienda": "KFC03",
  "tienda_nombre": "KENTUCKY FRIED CHICKEN",
  "fecha": "2025-05-28",
  "hora": "19:21:11",
  "ticket_electronico": null,
  "id_boleta": "20250528-01-000356630",
  "id_check": "95e86689-9f57-42bd-8a7f-8a47a0390cb4",
  "monto_op_gravada": 3.5,
  "importe_total": 3.5,
  "recargo_consumo": 0.17,
  "monto_tarifario": 0.0,
  "mes": 5,
  "anio": 2025,
  "momento": "2025-05-28T19:21:11",
  "a_c": null
}
```

### Validaciones Antes de Guardar

1. **Campos requeridos**: `fecha` y `canal` deben estar presentes
2. **Formato de fecha**: Debe ser `YYYY-MM-DD`
3. **Formato de hora**: Debe ser `HH:MM:SS`
4. **Formato de momento**: Se construye automáticamente si no está presente

### Campos de Auditoría

El sistema agrega automáticamente:

- `fecha_carga`: TIMESTAMP de cuando se guardó la factura
- `usuario_carga`: STRING con el email del usuario que guardó

### Inserción en BigQuery

```python
rows_to_insert = [{
    "id_caja": "0012",
    "canal": "Salon",
    # ... todos los campos ...
    "fecha_carga": datetime.now(),  # Agregado automáticamente
    "usuario_carga": "usuario@ejemplo.com"  # Agregado automáticamente
}]

bigquery_client.insert_rows_json(table, rows_to_insert)
```

### Manejo de Errores de BigQuery

- **Error de esquema**: Se valida antes de insertar
- **Error de permisos**: Se verifica que las credenciales sean correctas
- **Error de datos**: Se valida formato antes de insertar

---

## 📊 Esquema de Datos

### Esquema de BigQuery

La tabla `facturas` tiene el siguiente esquema:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_caja` | STRING | Número de caja (ej: "0012") |
| `canal` | STRING | Canal de venta (ej: "Salon", "Delivery") |
| `codigo_tienda` | STRING | Código de la tienda (ej: "KFC03") |
| `tienda_nombre` | STRING | Nombre de la tienda (ej: "KENTUCKY FRIED CHICKEN") |
| `fecha` | DATE | Fecha de la factura (YYYY-MM-DD) |
| `hora` | TIME | Hora de la factura (HH:MM:SS) |
| `ticket_electronico` | STRING | Número de ticket electrónico |
| `id_boleta` | STRING | Número de boleta/ticket |
| `id_check` | STRING | UUID único de la factura |
| `monto_op_gravada` | FLOAT64 | Monto de operación gravada |
| `importe_total` | FLOAT64 | Importe total de la factura |
| `recargo_consumo` | FLOAT64 | Recargo por consumo |
| `monto_tarifario` | FLOAT64 | Monto tarifario |
| `mes` | INTEGER | Mes extraído de la fecha (1-12) |
| `anio` | INTEGER | Año extraído de la fecha |
| `momento` | DATETIME | Combinación de fecha y hora |
| `a_c` | STRING | Campo adicional |
| `fecha_carga` | TIMESTAMP | Cuándo se guardó en BigQuery |
| `usuario_carga` | STRING | Email del usuario que guardó |

### Mapeo de Campos n8n → BigQuery

| Campo n8n | Campo BigQuery | Notas |
|-----------|----------------|-------|
| `competidor` | `tienda_nombre` | Nombre del competidor |
| `local` | `codigo_tienda` | Código del local |
| `canal_de_venta` | `canal` | Canal de venta |
| `numero_de_ticket` | `id_boleta` | Número de ticket |
| `fecha` | `fecha` | Fecha de la factura |
| `hora` | `hora` | Hora de la factura |
| `importe_total` | `importe_total` | Importe total |
| `recargo_consumo` | `recargo_consumo` | Recargo por consumo |
| `monto_tarifario` | `monto_tarifario` | Monto tarifario |
| `id_caja` | `id_caja` | ID de caja |
| `a_c` | `a_c` | Campo adicional |

### Campos Derivados

- **`mes`**: Extraído de `fecha` (1-12)
- **`anio`**: Extraído de `fecha` (YYYY)
- **`momento`**: Combinación de `fecha` y `hora` (YYYY-MM-DDTHH:MM:SS)
- **`id_check`**: UUID generado automáticamente
- **`monto_op_gravada`**: Por defecto igual a `importe_total`

---

## 🔧 Configuración

### Variables de Entorno (.env)

#### Backend

```bash
# n8n
N8N_WEBHOOK_URL=https://tu-n8n-instance.com/webhook/xxx
N8N_TIMEOUT=60              # Opcional, default: 60
N8N_MAX_RETRIES=3           # Opcional, default: 3
N8N_RETRY_BACKOFF=1.5       # Opcional, default: 1.5

# BigQuery
GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/credenciales.json
BIGQUERY_PROJECT_ID=tu-project-id
BIGQUERY_DATASET_ID=tu-dataset-id
BIGQUERY_TABLE_ID=facturas

# Google OAuth
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com

# Servidor
PORT=8000                   # Opcional, default: 8000
UVICORN_WORKERS=1           # Opcional, default: 1 (usar 4-8 en producción)
FRONTEND_URL=https://tu-frontend.com  # Opcional, para CORS en producción
```

#### Frontend

```bash
VITE_API_URL=http://localhost:8000  # URL del backend
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

---

## 📝 Notas Adicionales

### Optimizaciones Implementadas

1. **Connection Pooling**: Reutiliza conexiones HTTP a n8n
2. **Retry Logic**: Reintenta automáticamente en caso de errores temporales
3. **Múltiples Workers**: Soporta múltiples workers de uvicorn para mayor concurrencia
4. **Manejo de Errores**: Sistema robusto de manejo de errores con cola de errores

### Limitaciones Conocidas

1. **Procesamiento secuencial en batch**: Los archivos se procesan uno por uno (no en paralelo)
2. **Timeout de n8n**: Si n8n tarda más de 60 segundos, se cancela la operación
3. **Tamaño de imagen**: No hay límite explícito, pero imágenes muy grandes pueden causar problemas

### Mejoras Futuras Sugeridas

1. **Procesamiento paralelo en batch**: Procesar múltiples archivos simultáneamente
2. **Sistema de colas**: Implementar Redis + Celery para procesamiento asíncrono
3. **Cache de resultados**: Evitar reprocesar facturas idénticas
4. **Rate limiting**: Limitar requests por usuario para evitar abuso

---

## 📞 Soporte

Para más información o problemas, consulta:
- `README.md`: Instrucciones de instalación
- `N8N_OPTIMIZATION.md`: Optimizaciones de n8n
- `GOOGLE_OAUTH_SETUP.md`: Configuración de OAuth
