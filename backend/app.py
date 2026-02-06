"""
Backend FastAPI para procesamiento y validación de facturas con integración a BigQuery.
Expone endpoints para procesar imágenes de facturas y guardar datos validados.
"""
import os
import uuid
import json
import time
from datetime import datetime
from typing import Optional
from threading import Lock
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import logging
import traceback
from google.cloud import bigquery
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from invoice_parser import parse_and_map_invoice, parse_structured_data

# Cargar variables de entorno
load_dotenv()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),  # Mostrar en consola
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Invoice Processing API", version="1.0.0")

# Cargar lista de usuarios autorizados
# Buscar authorized_users.json en el directorio del script o en el directorio actual
import os
_script_dir = os.path.dirname(os.path.abspath(__file__))
AUTHORIZED_USERS_FILE = os.path.join(_script_dir, 'authorized_users.json')
authorized_emails = set()
superadmin_emails = set()
# Lock para proteger escrituras concurrentes al archivo
_users_file_lock = Lock()

def load_authorized_users():
    """Cargar lista de usuarios autorizados y superadmins desde el archivo JSON"""
    global authorized_emails, superadmin_emails
    try:
        if os.path.exists(AUTHORIZED_USERS_FILE):
            with open(AUTHORIZED_USERS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Normalizar emails a minúsculas para comparación
                authorized_emails = set(email.lower().strip() for email in data.get('authorized_emails', []))
                superadmin_emails = set(email.lower().strip() for email in data.get('superadmin_emails', []))
                logger.info(f"✅ Cargados {len(authorized_emails)} usuarios autorizados: {list(authorized_emails)}")
                logger.info(f"✅ Cargados {len(superadmin_emails)} superadmins: {list(superadmin_emails)}")
        else:
            logger.warning(f"⚠️ Archivo {AUTHORIZED_USERS_FILE} no encontrado. Creando archivo de ejemplo...")
            # Crear archivo de ejemplo
            example_data = {
                "superadmin_emails": [],
                "authorized_emails": [
                    "usuario1@ejemplo.com",
                    "usuario2@ejemplo.com"
                ],
                "note": "Los superadmins pueden gestionar usuarios. Agrega los emails autorizados en esta lista."
            }
            with open(AUTHORIZED_USERS_FILE, 'w', encoding='utf-8') as f:
                json.dump(example_data, f, indent=2, ensure_ascii=False)
            logger.info(f"📝 Archivo {AUTHORIZED_USERS_FILE} creado. Agrega los emails autorizados.")
            authorized_emails = set()
            superadmin_emails = set()
    except Exception as e:
        logger.error(f"❌ Error al cargar usuarios autorizados: {e}")
        authorized_emails = set()
        superadmin_emails = set()

def save_authorized_users():
    """Guardar lista de usuarios autorizados y superadmins en el archivo JSON (thread-safe)"""
    with _users_file_lock:  # Proteger contra escrituras concurrentes
        try:
            data = {
                "superadmin_emails": list(superadmin_emails),
                "authorized_emails": list(authorized_emails),
                "note": "Los superadmins pueden gestionar usuarios. Los emails deben coincidir exactamente con los emails de Google."
            }
            with open(AUTHORIZED_USERS_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info(f"✅ Usuarios guardados exitosamente")
            return True
        except Exception as e:
            logger.error(f"❌ Error al guardar usuarios autorizados: {e}")
            return False

def is_superadmin(email: str) -> bool:
    """Verificar si un email pertenece a un superadmin"""
    return email.lower().strip() in superadmin_emails

# Cargar usuarios autorizados al iniciar
load_authorized_users()

# Security
security = HTTPBearer(auto_error=False)

async def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Verificar token de Google OAuth usando la API de Google"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Token de autenticación requerido")
    
    token = credentials.credentials
    try:
        # Verificar el token con Google usando la API
        user_info_response = requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10
        )
        
        if user_info_response.status_code != 200:
            logger.error(f"❌ Token inválido según Google API: {user_info_response.status_code}")
            raise HTTPException(status_code=401, detail="Token inválido o expirado")
        
        google_user_data = user_info_response.json()
        email = google_user_data.get('email', '').lower().strip()
        
        if not email:
            raise HTTPException(status_code=401, detail="Email no encontrado en el token")
        
        # Verificar si el usuario está autorizado
        if email not in authorized_emails:
            logger.warning(f"⚠️ Intento de acceso no autorizado: {email}")
            raise HTTPException(status_code=403, detail="Usuario no autorizado")
        
        return email
    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Error al verificar token con Google API: {e}")
        raise HTTPException(status_code=401, detail="Error al verificar token con Google")
    except Exception as e:
        logger.error(f"Error al verificar token: {e}")
        raise HTTPException(status_code=401, detail="Error al verificar token")

# Configurar CORS para permitir requests del frontend
# Permitir localhost para desarrollo y dominios de producción desde variables de entorno
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
CORS_ORIGINS = [
    "http://localhost:5173",  # Vite default port
    "http://localhost:3000",   # React default port
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
# Agregar URL de producción si está configurada
if FRONTEND_URL:
    CORS_ORIGINS.append(FRONTEND_URL)
    # También agregar variante con/sin www y https/http
    if FRONTEND_URL.startswith("https://"):
        CORS_ORIGINS.append(FRONTEND_URL.replace("https://", "http://"))
    if "www." not in FRONTEND_URL:
        CORS_ORIGINS.append(FRONTEND_URL.replace("://", "://www."))

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración
N8N_WEBHOOK_URL = os.getenv('N8N_WEBHOOK_URL')
BIGQUERY_PROJECT_ID = os.getenv('BIGQUERY_PROJECT_ID')
BIGQUERY_DATASET_ID = os.getenv('BIGQUERY_DATASET_ID')
BIGQUERY_TABLE_ID = os.getenv('BIGQUERY_TABLE_ID')

# Configuración de n8n (timeouts y retries)
N8N_TIMEOUT = int(os.getenv('N8N_TIMEOUT', '60'))  # Timeout por defecto: 60 segundos
N8N_MAX_RETRIES = int(os.getenv('N8N_MAX_RETRIES', '3'))  # Máximo de reintentos
N8N_RETRY_BACKOFF = float(os.getenv('N8N_RETRY_BACKOFF', '1.5'))  # Factor de backoff exponencial

# Crear sesión HTTP con connection pooling y retry logic
def create_n8n_session():
    """Crear sesión HTTP optimizada para llamadas a n8n con connection pooling y retry"""
    session = requests.Session()
    
    # Configurar retry strategy
    retry_strategy = Retry(
        total=N8N_MAX_RETRIES,
        backoff_factor=N8N_RETRY_BACKOFF,
        status_forcelist=[429, 500, 502, 503, 504],  # Reintentar en estos códigos HTTP
        allowed_methods=["POST"]  # Solo reintentar POST
    )
    
    # Configurar adapter con connection pooling
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=10,  # Número de pools de conexión
        pool_maxsize=20,  # Máximo de conexiones por pool
        pool_block=False  # No bloquear si el pool está lleno
    )
    
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    return session

# Crear sesión global para reutilizar conexiones
n8n_session = create_n8n_session()

# Logging de configuración al inicio
logger.info("=" * 60)
logger.info("CONFIGURACIÓN DE BIGQUERY:")
logger.info(f"  Project ID: {BIGQUERY_PROJECT_ID}")
logger.info(f"  Dataset ID: {BIGQUERY_DATASET_ID}")
logger.info(f"  Table ID: {BIGQUERY_TABLE_ID}")
if BIGQUERY_PROJECT_ID and BIGQUERY_DATASET_ID and BIGQUERY_TABLE_ID:
    logger.info(f"  Tabla completa: {BIGQUERY_PROJECT_ID}.{BIGQUERY_DATASET_ID}.{BIGQUERY_TABLE_ID}")
logger.info("=" * 60)

# Inicializar cliente de BigQuery
bigquery_client = None
GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

if BIGQUERY_PROJECT_ID:
    try:
        # Verificar que las credenciales estén configuradas
        if GOOGLE_APPLICATION_CREDENTIALS:
            if os.path.exists(GOOGLE_APPLICATION_CREDENTIALS):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GOOGLE_APPLICATION_CREDENTIALS
                logger.info(f"Usando credenciales de: {GOOGLE_APPLICATION_CREDENTIALS}")
            else:
                logger.warning(f"⚠️ Archivo de credenciales no encontrado: {GOOGLE_APPLICATION_CREDENTIALS}")
        else:
            logger.warning("⚠️ GOOGLE_APPLICATION_CREDENTIALS no está configurada en .env")
        
        bigquery_client = bigquery.Client(project=BIGQUERY_PROJECT_ID)
        logger.info(f"✅ Cliente de BigQuery inicializado correctamente. Project: {BIGQUERY_PROJECT_ID}")
    except Exception as e:
        logger.error(f"❌ Error al inicializar BigQuery client: {e}")
        logger.error("Verifica que:")
        logger.error("  1. GOOGLE_APPLICATION_CREDENTIALS esté configurada en .env")
        logger.error("  2. El archivo de credenciales exista y sea válido")
        logger.error("  3. La cuenta de servicio tenga los roles necesarios (BigQuery Data Editor, BigQuery Job User)")
else:
    logger.warning("⚠️ BIGQUERY_PROJECT_ID no está configurada en .env")


# Modelos Pydantic para validación
class MappedInvoiceData(BaseModel):
    """Modelo de datos mapeados del backend al frontend"""
    id_caja: Optional[str] = None
    canal: Optional[str] = None
    codigo_tienda: Optional[str] = None
    tienda_nombre: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    ticket_electronico: Optional[str] = None
    id_boleta: Optional[str] = None
    id_check: str
    monto_op_gravada: float = 0.0
    importe_total: float = 0.0
    recargo_consumo: float = 0.0
    monto_tarifario: float = 0.0
    mes: Optional[int] = None
    anio: Optional[int] = None
    momento: Optional[str] = None
    a_c: Optional[str] = None
    raw_extracted_text: Optional[str] = None  # Texto crudo extraído por OCR


class ValidatedInvoiceData(BaseModel):
    """Modelo de datos validados del frontend al backend"""
    id_caja: Optional[str] = None
    canal: Optional[str] = None
    codigo_tienda: Optional[str] = None
    tienda_nombre: Optional[str] = None
    fecha: str
    hora: Optional[str] = None
    ticket_electronico: Optional[str] = None
    id_boleta: Optional[str] = None
    id_check: str
    monto_op_gravada: float
    importe_total: float
    recargo_consumo: float = 0.0
    monto_tarifario: float = 0.0
    mes: Optional[int] = None
    anio: Optional[int] = None
    momento: Optional[str] = None
    a_c: Optional[str] = None


@app.get("/")
def root():
    """Endpoint raíz"""
    return {"message": "Invoice Processing API", "status": "running"}

@app.get("/api/debug/users")
def debug_users():
    """Endpoint de debug para verificar usuarios cargados (solo para desarrollo)"""
    return {
        "authorized_emails": list(authorized_emails),
        "superadmin_emails": list(superadmin_emails),
        "total_authorized": len(authorized_emails),
        "total_superadmins": len(superadmin_emails)
    }


@app.post("/api/verify-user")
async def verify_user(request: dict):
    """
    Verificar si un usuario está autorizado basándose en su email.
    El frontend ya verificó el token con Google y nos envía el email del usuario.
    """
    email = request.get('email')
    token = request.get('token')
    
    if not email:
        raise HTTPException(status_code=400, detail="Email requerido")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token requerido")
    
    # Verificar el token con Google para asegurar que es válido
    try:
        logger.info(f"Verificando usuario: {email}")
        logger.info(f"Emails autorizados: {list(authorized_emails)}")
        
        # Verificar que el token es válido haciendo una petición a la API de Google
        user_info_response = requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10
        )
        
        if user_info_response.status_code != 200:
            logger.error(f"❌ Token inválido según Google API: {user_info_response.status_code}")
            raise HTTPException(status_code=401, detail="Token inválido o expirado")
        
        google_user_data = user_info_response.json()
        verified_email = google_user_data.get('email', '').lower().strip()
        received_email = email.lower().strip()
        
        logger.info(f"Email verificado desde Google API: {verified_email}")
        logger.info(f"Email recibido del frontend: {received_email}")
        
        if verified_email != received_email:
            logger.warning(f"⚠️ Email no coincide: Google={verified_email}, Frontend={received_email}")
            raise HTTPException(status_code=401, detail=f"Email no coincide. Verificado: {verified_email}, Recibido: {received_email}")
        
        # Verificar si está autorizado
        is_authorized = verified_email in authorized_emails
        
        logger.info(f"Verificación de usuario: {verified_email} - {'✅ Autorizado' if is_authorized else '❌ No autorizado'}")
        
        if not is_authorized:
            logger.warning(f"⚠️ Usuario no autorizado: {verified_email}. Emails autorizados: {list(authorized_emails)}")
        
        is_superadmin_user = is_superadmin(verified_email)
        
        return {
            "authorized": is_authorized,
            "is_superadmin": is_superadmin_user,
            "email": verified_email
        }
    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Error al verificar token con Google API: {e}")
        raise HTTPException(status_code=401, detail="Error al verificar token con Google")
    except Exception as e:
        logger.error(f"❌ Error al verificar usuario: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail=f"Error al verificar usuario: {str(e)}")


@app.post("/api/verify-token")
async def verify_token_endpoint(request: dict):
    """
    Verificar si un token sigue siendo válido y si el usuario está autorizado
    """
    token = request.get('token')
    
    if not token:
        return {
            "valid": False,
            "authorized": False
        }
    
    try:
        # Verificar el token con Google usando la API
        user_info_response = requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10
        )
        
        if user_info_response.status_code != 200:
            return {
                "valid": False,
                "authorized": False
            }
        
        google_user_data = user_info_response.json()
        email = google_user_data.get('email', '').lower().strip()
        
        if not email:
            return {
                "valid": False,
                "authorized": False
            }
        
        is_authorized = email in authorized_emails
        is_superadmin_user = is_superadmin(email)
        
        return {
            "valid": True,
            "authorized": is_authorized,
            "is_superadmin": is_superadmin_user,
            "email": email
        }
    except requests.exceptions.RequestException:
        return {
            "valid": False,
            "authorized": False
        }
    except Exception as e:
        logger.error(f"Error al verificar token: {e}")
        return {
            "valid": False,
            "authorized": False
        }


@app.post("/api/test-parse")
async def test_parse(data: dict):
    """
    Endpoint de prueba para testear el parsing de datos estructurados
    """
    try:
        logger.info(f"Recibidos datos de prueba: {data}")
        if isinstance(data, list):
            mapped_data_dict = parse_structured_data(data)
            mapped_data = MappedInvoiceData(**mapped_data_dict)
            return {"success": True, "data": mapped_data.model_dump()}
        else:
            return {"success": False, "error": "Se espera un array de objetos"}
    except Exception as e:
        logger.error(f"Error en test-parse: {str(e)}", exc_info=True)
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@app.post("/api/process-invoice", response_model=MappedInvoiceData)
async def process_invoice(
    invoice_image: UploadFile = File(...),
    email: str = Depends(verify_token)
):
    """
    Endpoint para procesar una imagen de factura.
    1. Recibe la imagen del frontend
    2. Llama al servicio n8n para extraer texto
    3. Parsea y mapea el texto al esquema de BigQuery
    4. Retorna datos estructurados para validación
    """
    logger.info(f"Iniciando procesamiento de factura: {invoice_image.filename}")
    try:
        # Validar tipo de archivo
        if not invoice_image.content_type or not invoice_image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")
        
        # Leer contenido del archivo
        file_content = await invoice_image.read()
        
        # Llamar al servicio n8n para extraer texto
        if not N8N_WEBHOOK_URL:
            raise HTTPException(
                status_code=500,
                detail="URL de webhook n8n no configurada"
            )
        
        files = {'invoice_image': (invoice_image.filename, file_content, invoice_image.content_type)}
        
        # Usar sesión con connection pooling y retry logic
        try:
            start_time = time.time()
            response = n8n_session.post(
                N8N_WEBHOOK_URL, 
                files=files, 
                timeout=N8N_TIMEOUT,
                stream=False  # No usar streaming para archivos pequeños
            )
            elapsed_time = time.time() - start_time
            logger.info(f"✅ Respuesta de n8n recibida en {elapsed_time:.2f} segundos")
        except requests.exceptions.Timeout:
            elapsed_time = time.time() - start_time if 'start_time' in locals() else N8N_TIMEOUT
            logger.error(f"❌ Timeout después de {elapsed_time:.2f} segundos")
            raise HTTPException(
                status_code=504,
                detail=f"Timeout al llamar al servicio de extracción (más de {N8N_TIMEOUT} segundos). El servicio n8n puede estar sobrecargado."
            )
        except requests.exceptions.ConnectionError as e:
            logger.error(f"❌ Error de conexión con n8n: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"No se pudo conectar con el webhook de n8n. Verifica que el servicio esté disponible: {N8N_WEBHOOK_URL}"
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Error en request a n8n: {e}")
            raise HTTPException(
                status_code=502,
                detail=f"Error al comunicarse con n8n: {str(e)}"
            )
        
        if response.status_code != 200:
            error_detail = f"Error al llamar al servicio de extracción: {response.status_code}"
            try:
                error_body = response.json()
                if 'message' in error_body:
                    error_detail += f" - {error_body['message']}"
                elif 'detail' in error_body:
                    error_detail += f" - {error_body['detail']}"
            except:
                error_detail += f" - {response.text[:200]}"
            
            raise HTTPException(
                status_code=500,
                detail=error_detail
            )
        
        # Extraer datos de la respuesta
        try:
            response_data = response.json()
            logger.info(f"Respuesta de n8n recibida. Tipo: {type(response_data)}")
            logger.info(f"Respuesta completa (primeros 500 chars): {str(response_data)[:500]}")
            if isinstance(response_data, list):
                logger.info(f"Es un array con {len(response_data)} elementos")
                if len(response_data) > 0:
                    logger.info(f"Primer elemento: {response_data[0]}")
            elif isinstance(response_data, dict):
                logger.info(f"Es un dict con keys: {list(response_data.keys())[:5]}")
                # Verificar si el dict contiene un array en alguna key
                for key, value in response_data.items():
                    if isinstance(value, list):
                        logger.info(f"  - Key '{key}' contiene un array con {len(value)} elementos")
        except ValueError as e:
            logger.error(f"Error al parsear JSON de n8n: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"El webhook de n8n no devolvió JSON válido: {response.text[:200]}"
            )
        
        # Detectar formato de respuesta de n8n
        mapped_data_dict = None
        raw_extracted_text = None
        
        # Formato 1: Array que contiene objeto con "data" [{"data": [{"clave": "...", "valor": "..."}, ...]}]
        if isinstance(response_data, list) and len(response_data) > 0:
            logger.info("Verificando si es array estructurado...")
            # Verificar si el primer elemento es un dict con key "data" que contiene el array estructurado
            if isinstance(response_data[0], dict) and 'data' in response_data[0]:
                data_array = response_data[0]['data']
                if isinstance(data_array, list) and len(data_array) > 0:
                    if isinstance(data_array[0], dict) and 'clave' in data_array[0] and 'valor' in data_array[0]:
                        logger.info(f"✅ Detectado formato estructurado (array con 'data' key) con {len(data_array)} items")
                        try:
                            mapped_data_dict = parse_structured_data(data_array)
                            logger.info(f"Datos mapeados exitosamente. id_check: {mapped_data_dict.get('id_check')}")
                        except Exception as parse_error:
                            logger.error(f"Error al parsear datos estructurados: {parse_error}", exc_info=True)
                            raise HTTPException(
                                status_code=500,
                                detail=f"Error al procesar datos estructurados: {str(parse_error)}"
                            )
                        # Guardar el formato estructurado como texto para visualización (JSON formateado)
                        raw_extracted_text = json.dumps(data_array, indent=2, ensure_ascii=False)
            # Formato 1a: Array estructurado directo [{"clave": "...", "valor": "..."}, ...]
            elif isinstance(response_data[0], dict) and 'clave' in response_data[0] and 'valor' in response_data[0]:
                logger.info(f"✅ Detectado formato estructurado (array directo) con {len(response_data)} items")
                try:
                    mapped_data_dict = parse_structured_data(response_data)
                    logger.info(f"Datos mapeados exitosamente. id_check: {mapped_data_dict.get('id_check')}")
                except Exception as parse_error:
                    logger.error(f"Error al parsear datos estructurados: {parse_error}", exc_info=True)
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error al procesar datos estructurados: {str(parse_error)}"
                    )
                # Guardar el formato estructurado como texto para visualización (JSON formateado)
                raw_extracted_text = json.dumps(response_data, indent=2, ensure_ascii=False)
        
        # Formato 1b: Objeto individual con estructura {"clave": "...", "valor": "..."}
        # O dict que contiene un array en alguna key
        elif isinstance(response_data, dict):
            # Verificar si contiene un array estructurado en alguna key
            structured_array_found = None
            for key, value in response_data.items():
                if isinstance(value, list) and len(value) > 0:
                    if isinstance(value[0], dict) and 'clave' in value[0] and 'valor' in value[0]:
                        logger.info(f"✅ Detectado formato estructurado (array dentro de dict, key: '{key}')")
                        structured_array_found = value
                        break
            
            if structured_array_found:
                try:
                    mapped_data_dict = parse_structured_data(structured_array_found)
                    logger.info(f"Datos mapeados exitosamente. id_check: {mapped_data_dict.get('id_check')}")
                except Exception as parse_error:
                    logger.error(f"Error al parsear datos estructurados: {parse_error}", exc_info=True)
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error al procesar datos estructurados: {str(parse_error)}"
                    )
                raw_extracted_text = json.dumps(structured_array_found, indent=2, ensure_ascii=False)
            elif 'clave' in response_data and 'valor' in response_data:
                logger.warning("⚠️ Detectado formato estructurado (objeto individual) - n8n debería devolver un array completo")
                logger.warning("⚠️ Solo se procesará este objeto individual. Verifica la configuración de n8n.")
                # Convertir a array para procesar
                structured_array = [response_data]
                try:
                    mapped_data_dict = parse_structured_data(structured_array)
                    logger.info(f"Datos mapeados exitosamente. id_check: {mapped_data_dict.get('id_check')}")
                except Exception as parse_error:
                    logger.error(f"Error al parsear datos estructurados: {parse_error}", exc_info=True)
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error al procesar datos estructurados: {str(parse_error)}"
                    )
                # Guardar el formato estructurado como texto para visualización (JSON formateado)
                raw_extracted_text = json.dumps(structured_array, indent=2, ensure_ascii=False)
        
        # Formato 2: {"extracted_text": "..."} - Texto crudo
        elif isinstance(response_data, dict) and 'extracted_text' in response_data:
            extracted_text = response_data.get('extracted_text', '')
            if extracted_text:
                mapped_data_dict = parse_and_map_invoice(extracted_text)
                raw_extracted_text = extracted_text
        
        # Formato 3: Respuesta completa de Google Vision AI
        elif isinstance(response_data, dict) and 'responses' in response_data and len(response_data['responses']) > 0:
            first_response = response_data['responses'][0]
            if 'fullTextAnnotation' in first_response and 'text' in first_response['fullTextAnnotation']:
                extracted_text = first_response['fullTextAnnotation']['text']
                mapped_data_dict = parse_and_map_invoice(extracted_text)
                raw_extracted_text = extracted_text
        
        # Formato 4: {"fullTextAnnotation": {"text": "..."}}
        elif isinstance(response_data, dict) and 'fullTextAnnotation' in response_data and 'text' in response_data['fullTextAnnotation']:
            extracted_text = response_data['fullTextAnnotation']['text']
            mapped_data_dict = parse_and_map_invoice(extracted_text)
            raw_extracted_text = extracted_text
        
        # Formato 5: Texto directo en el campo "text"
        elif isinstance(response_data, dict) and 'text' in response_data:
            extracted_text = response_data.get('text', '')
            if extracted_text:
                mapped_data_dict = parse_and_map_invoice(extracted_text)
                raw_extracted_text = extracted_text
        
        # Formato 6: Buscar cualquier campo que contenga texto
        elif isinstance(response_data, dict):
            for key in ['description', 'content', 'data']:
                if key in response_data and isinstance(response_data[key], str):
                    extracted_text = response_data[key]
                    mapped_data_dict = parse_and_map_invoice(extracted_text)
                    raw_extracted_text = extracted_text
                    break
        
        if not mapped_data_dict:
            logger.error(f"❌ No se pudo detectar el formato de la respuesta")
            logger.error(f"Tipo de respuesta: {type(response_data)}")
            logger.error(f"Contenido completo: {response_data}")
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo procesar la respuesta del webhook. Formato no reconocido. Tipo recibido: {type(response_data).__name__}. Contenido: {str(response_data)[:500]}"
            )
        
        # Agregar el texto crudo extraído para visualización/debug
        mapped_data_dict["raw_extracted_text"] = raw_extracted_text or str(response_data)
        
        # Convertir diccionario a modelo Pydantic
        try:
            mapped_data = MappedInvoiceData(**mapped_data_dict)
        except Exception as validation_error:
            logger.error(f"Error al validar datos mapeados: {validation_error}")
            logger.error(f"Datos mapeados: {mapped_data_dict}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al validar los datos extraídos: {str(validation_error)}. Datos: {str(mapped_data_dict)[:300]}"
            )
        
        logger.info(f"Factura procesada exitosamente. id_check: {mapped_data.id_check}")
        return mapped_data
    
    except HTTPException:
        # Re-lanzar HTTPException sin modificar
        raise
    except requests.exceptions.RequestException as e:
        logger.error(f"Error de requests: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error al comunicarse con el servicio de extracción: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error inesperado al procesar factura: {str(e)}", exc_info=True)
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Traceback completo:\n{error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Error interno del servidor: {str(e)}"
        )


@app.post("/api/save-invoice")
async def save_invoice(
    data: ValidatedInvoiceData,
    email: str = Depends(verify_token)
):
    """
    Endpoint para guardar datos validados de factura en BigQuery.
    1. Recibe datos validados del frontend
    2. Formatea datos según esquema de BigQuery
    3. Inserta fila en BigQuery
    4. Retorna confirmación
    """
    try:
        if not bigquery_client:
            raise HTTPException(
                status_code=500,
                detail="BigQuery no está configurado correctamente"
            )
        
        # Validar fecha requerida
        if not data.fecha:
            raise HTTPException(status_code=400, detail="El campo 'fecha' es requerido")
        
        # Convertir fecha string a DATE
        try:
            fecha_obj = datetime.strptime(data.fecha, '%Y-%m-%d')
            fecha_bigquery = fecha_obj.strftime('%Y-%m-%d')
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Formato de fecha inválido: {data.fecha}. Use YYYY-MM-DD"
            )
        
        # Convertir hora string a TIME (si existe)
        hora_bigquery = None
        if data.hora:
            try:
                # Validar formato de hora
                datetime.strptime(data.hora, '%H:%M:%S')
                hora_bigquery = data.hora
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Formato de hora inválido: {data.hora}. Use HH:MM:SS"
                )
        
        # Construir momento (DATETIME) si no está presente
        momento_bigquery = data.momento
        if not momento_bigquery and fecha_bigquery:
            if hora_bigquery:
                momento_bigquery = f"{fecha_bigquery}T{hora_bigquery}"
            else:
                momento_bigquery = f"{fecha_bigquery}T00:00:00"
        
        # Validar y convertir momento a formato DATETIME de BigQuery
        if momento_bigquery:
            try:
                # Parsear el momento y validar formato
                # Manejar diferentes formatos de entrada
                if 'T' in momento_bigquery:
                    momento_dt = datetime.fromisoformat(momento_bigquery.replace('Z', '+00:00').split('+')[0])
                else:
                    # Si no tiene 'T', asumir formato 'YYYY-MM-DD HH:MM:SS'
                    momento_dt = datetime.strptime(momento_bigquery, '%Y-%m-%d %H:%M:%S')
                
                # Formato para BigQuery: YYYY-MM-DDTHH:MM:SS
                momento_bigquery = momento_dt.strftime('%Y-%m-%dT%H:%M:%S')
                
                # Determinar si es apertura o cierre basado en la hora (para logging)
                hora_int = momento_dt.hour
                if hora_int < 12:
                    tipo_momento = "apertura"
                elif hora_int >= 16:
                    tipo_momento = "cierre"
                else:
                    tipo_momento = "medio_dia"
                
                logger.info(f"Momento calculado: {momento_bigquery} ({tipo_momento}, hora: {hora_int})")
            except (ValueError, AttributeError) as e:
                logger.warning(f"Error al parsear momento: {e}. Usando valor original: {momento_bigquery}")
                # Intentar formatear como string para BigQuery
                try:
                    momento_dt = datetime.strptime(momento_bigquery.split('T')[0], '%Y-%m-%d')
                    if hora_bigquery:
                        momento_bigquery = f"{momento_dt.strftime('%Y-%m-%d')}T{hora_bigquery}"
                    else:
                        momento_bigquery = f"{momento_dt.strftime('%Y-%m-%d')}T00:00:00"
                except:
                    pass
        
        # Obtener timestamp actual para fecha_carga (formato ISO 8601 para BigQuery TIMESTAMP)
        fecha_carga_timestamp = datetime.utcnow().isoformat() + 'Z'
        
        # Preparar fila para BigQuery con tipos correctos
        row = {
            "id_caja": data.id_caja,
            "canal": data.canal,
            "codigo_tienda": data.codigo_tienda,
            "tienda_nombre": data.tienda_nombre,  # Ya viene de 'competidor' desde el parser
            "fecha": fecha_bigquery,  # Formato YYYY-MM-DD (DATE)
            "hora": hora_bigquery,  # Formato HH:MM:SS (TIME)
            "ticket_electronico": data.ticket_electronico,
            "id_boleta": data.id_boleta,
            "id_check": data.id_check,
            "monto_op_gravada": float(data.monto_op_gravada),
            "importe_total": float(data.importe_total),
            "recargo_consumo": float(data.recargo_consumo),
            "monto_tarifario": float(data.monto_tarifario),
            "mes": data.mes,
            "anio": data.anio,
            "momento": momento_bigquery,  # Formato YYYY-MM-DDTHH:MM:SS (DATETIME)
            "a_c": data.a_c,
            "fecha_carga": fecha_carga_timestamp,  # Timestamp de cuando se hizo la carga (TIMESTAMP)
            "usuario_carga": email  # Email del usuario que hizo la carga (STRING)
        }
        
        logger.info(f"Preparando inserción en BigQuery. id_check: {data.id_check}, momento: {momento_bigquery}, usuario: {email}, fecha_carga: {fecha_carga_timestamp}")
        
        # Insertar en BigQuery
        table_id = f"{BIGQUERY_PROJECT_ID}.{BIGQUERY_DATASET_ID}.{BIGQUERY_TABLE_ID}"
        logger.info(f"🔵 Insertando en tabla: {table_id}")
        logger.info(f"🔵 Table ID desde .env: '{BIGQUERY_TABLE_ID}'")
        
        try:
            table = bigquery_client.get_table(table_id)
            logger.info(f"Tabla obtenida. Esquema de id_check: {[field for field in table.schema if field.name == 'id_check']}")
            
            # Verificar el tipo de id_check
            id_check_field = next((field for field in table.schema if field.name == 'id_check'), None)
            if id_check_field:
                logger.info(f"Tipo de id_check en BigQuery: {id_check_field.field_type}")
                if id_check_field.field_type != 'STRING':
                    raise HTTPException(
                        status_code=400,
                        detail=f"❌ ERROR DE ESQUEMA: La columna 'id_check' en la tabla '{table_id}' está definida como '{id_check_field.field_type}' pero debe ser 'STRING'. "
                               f"Ejecuta el script 'bigquery_schema.sql' para corregir el esquema. "
                               f"Tabla actual: {table_id}"
                    )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error al obtener tabla de BigQuery: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al acceder a la tabla de BigQuery: {str(e)}"
            )
        
        errors = bigquery_client.insert_rows_json(table, [row])
        
        if errors:
            error_details = str(errors)
            logger.error(f"Error al insertar en BigQuery: {error_details}")
            
            # Detectar errores de tipo de datos
            if "cannot convert value" in error_details.lower() or "bad value" in error_details.lower():
                # Extraer el campo problemático
                field_name = None
                if "'location':" in error_details or '"location":' in error_details:
                    import re
                    match = re.search(r'["\']location["\']:\s*["\']([^"\']+)["\']', error_details)
                    if match:
                        field_name = match.group(1)
                
                if field_name == "id_check":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Error de esquema en BigQuery: La columna 'id_check' está definida como INTEGER pero debe ser STRING. "
                               f"Ejecuta el script 'bigquery_alter_table.sql' para corregir el esquema. Error: {error_details}"
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Error de tipo de datos en BigQuery. Verifica que el esquema de la tabla coincida con los datos enviados. "
                               f"Campo problemático: {field_name}. Error: {error_details}"
                    )
            # Detectar errores de permisos específicos
            elif "permission" in error_details.lower() or "access denied" in error_details.lower() or "403" in error_details.lower():
                raise HTTPException(
                    status_code=403,
                    detail=f"Error de permisos en BigQuery. Verifica que la cuenta de servicio tenga los roles necesarios: 'BigQuery Data Editor', 'BigQuery Job User', y 'BigQuery User'. Error: {error_details}"
                )
            elif "not found" in error_details.lower() or "404" in error_details.lower():
                raise HTTPException(
                    status_code=404,
                    detail=f"Tabla o dataset no encontrado en BigQuery. Verifica que la tabla '{table_id}' exista. Error: {error_details}"
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error al insertar en BigQuery: {error_details}"
                )
        
        return {
            "success": True,
            "id_check": data.id_check,
            "message": "Factura guardada exitosamente en BigQuery"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error interno del servidor: {str(e)}"
        )


# Endpoints para gestión de usuarios (solo superadmins)
async def verify_superadmin(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Verificar que el usuario es superadmin"""
    email = await verify_token(credentials)
    if not is_superadmin(email):
        raise HTTPException(status_code=403, detail="Solo los superadmins pueden realizar esta acción")
    return email

@app.get("/api/admin/users")
async def get_users(email: str = Depends(verify_superadmin)):
    """Obtener lista de todos los usuarios autorizados"""
    return {
        "superadmins": list(superadmin_emails),
        "authorized_users": list(authorized_emails),
        "total_users": len(authorized_emails),
        "total_superadmins": len(superadmin_emails)
    }

@app.post("/api/admin/users/add")
async def add_user(request: dict, email: str = Depends(verify_superadmin)):
    """Agregar un usuario autorizado"""
    user_email = request.get('email', '').lower().strip()
    
    if not user_email:
        raise HTTPException(status_code=400, detail="Email requerido")
    
    if user_email in authorized_emails:
        return {"success": True, "message": "Usuario ya está autorizado", "email": user_email}
    
    authorized_emails.add(user_email)
    
    if save_authorized_users():
        logger.info(f"✅ Usuario agregado por {email}: {user_email}")
        return {"success": True, "message": "Usuario agregado exitosamente", "email": user_email}
    else:
        authorized_emails.discard(user_email)  # Revertir si falla el guardado
        raise HTTPException(status_code=500, detail="Error al guardar usuario")

@app.post("/api/admin/users/remove")
async def remove_user(request: dict, email: str = Depends(verify_superadmin)):
    """Eliminar un usuario autorizado (no puede eliminar superadmins)"""
    user_email = request.get('email', '').lower().strip()
    
    if not user_email:
        raise HTTPException(status_code=400, detail="Email requerido")
    
    # No permitir eliminar superadmins
    if is_superadmin(user_email):
        raise HTTPException(status_code=403, detail="No se puede eliminar un superadmin")
    
    # No permitir auto-eliminarse
    if user_email == email:
        raise HTTPException(status_code=403, detail="No puedes eliminarte a ti mismo")
    
    if user_email not in authorized_emails:
        return {"success": True, "message": "Usuario no estaba autorizado", "email": user_email}
    
    authorized_emails.discard(user_email)
    
    if save_authorized_users():
        logger.info(f"✅ Usuario eliminado por {email}: {user_email}")
        return {"success": True, "message": "Usuario eliminado exitosamente", "email": user_email}
    else:
        authorized_emails.add(user_email)  # Revertir si falla el guardado
        raise HTTPException(status_code=500, detail="Error al guardar cambios")


if __name__ == '__main__':
    import uvicorn
    import sys
    
    # Verificar configuración
    if not N8N_WEBHOOK_URL:
        print("ADVERTENCIA: N8N_WEBHOOK_URL no está configurada en .env")
    if not BIGQUERY_PROJECT_ID:
        print("ADVERTENCIA: BIGQUERY_PROJECT_ID no está configurada en .env")
    
    # Permitir cambiar el puerto desde variable de entorno o argumento
    # Render siempre proporciona PORT, así que lo usamos directamente
    port = int(os.getenv('PORT', 8000))
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    
    # Detectar si estamos en Render (tiene PORT definido y no es 8000, o tiene RENDER)
    is_render = os.getenv('RENDER') == 'true' or (os.getenv('PORT') and int(os.getenv('PORT', 8000)) != 8000)
    
    # En Render, siempre usar 1 worker para evitar problemas con detección de puerto
    # En local, permitir múltiples workers si está configurado
    if is_render:
        workers = 1
        logger.info(f"🚀 Iniciando servidor en Render (puerto {port}, 1 worker)")
    else:
        workers = int(os.getenv('UVICORN_WORKERS', '1'))
        if workers > 1:
            logger.info(f"🚀 Iniciando servidor con {workers} workers para mayor concurrencia")
        else:
            logger.info("🚀 Iniciando servidor en modo desarrollo (1 worker)")
    
    logger.info(f"📊 Configuración n8n: timeout={N8N_TIMEOUT}s, retries={N8N_MAX_RETRIES}, backoff={N8N_RETRY_BACKOFF}")
    logger.info(f"🌐 Escuchando en 0.0.0.0:{port}")
    
    # Siempre usar un solo worker para evitar problemas con Render
    # Render maneja el escalado horizontalmente, no necesitamos múltiples workers
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
