"""
Módulo para parsear y mapear texto extraído de facturas al esquema de BigQuery.
Implementa la lógica de extracción y derivación según las especificaciones.
"""
import re
import uuid
from datetime import datetime
from typing import Dict, Optional


def extract_id_caja(text: str) -> Optional[str]:
    """
    Extrae el número después de la palabra 'Caja'.
    Ejemplo: "Caja 0012" -> "0012"
    """
    pattern = r'Caja\s+(\d+)'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1).zfill(4)  # Asegurar 4 dígitos con ceros a la izquierda
    return None


def extract_codigo_tienda(text: str) -> Optional[str]:
    """
    Extrae el código numérico al inicio de la primera línea.
    Ejemplo: "015 SAN MARTIN" -> "015"
    """
    lines = text.split('\n')
    for line in lines[:5]:  # Buscar en las primeras líneas
        line = line.strip()
        # Buscar patrón: número al inicio seguido de texto
        pattern = r'^(\d{2,4})\s+([A-Z\s]+)'
        match = re.match(pattern, line)
        if match:
            return match.group(1)
    return None


def extract_tienda_nombre(text: str) -> Optional[str]:
    """
    Extrae el texto que sigue al código de tienda en la primera línea.
    Ejemplo: "015 SAN MARTIN" -> "SAN MARTIN"
    """
    lines = text.split('\n')
    for line in lines[:5]:
        line = line.strip()
        pattern = r'^\d{2,4}\s+([A-Z\s]+)'
        match = re.match(pattern, line)
        if match:
            nombre = match.group(1).strip()
            # Limpiar caracteres extra
            nombre = re.sub(r'\s+', ' ', nombre)
            return nombre[:100]  # Limitar longitud
    return None


def extract_fecha(text: str) -> Optional[str]:
    """
    Extrae el valor después de la palabra 'Fecha' y formatea a YYYY-MM-DD.
    Ejemplo: "Fecha 06/11/24" -> "2024-11-06"
    """
    # Buscar patrón "Fecha" seguido de fecha
    pattern = r'Fecha\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        # Buscar patrón alternativo sin palabra "Fecha"
        pattern_alt = r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b'
        matches = re.findall(pattern_alt, text)
        if matches:
            match_str = matches[0]
        else:
            return None
    else:
        match_str = match.group(1)
    
    # Parsear fecha
    separators = ['/', '-']
    for sep in separators:
        if sep in match_str:
            parts = match_str.split(sep)
            if len(parts) == 3:
                try:
                    day = int(parts[0])
                    month = int(parts[1])
                    year = int(parts[2])
                    
                    # Ajustar año de 2 dígitos a 4
                    if year < 100:
                        year += 2000
                    
                    fecha_obj = datetime(year, month, day)
                    return fecha_obj.strftime('%Y-%m-%d')
                except (ValueError, IndexError):
                    continue
    return None


def extract_hora(text: str) -> Optional[str]:
    """
    Extrae el valor después de la palabra 'Hora'.
    Ejemplo: "Hora 16:05:47" -> "16:05:47"
    """
    pattern = r'Hora\s+(\d{1,2}:\d{2}:\d{2})'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Buscar patrón de hora sin palabra "Hora"
    pattern_alt = r'\b(\d{1,2}:\d{2}:\d{2})\b'
    match_alt = re.search(pattern_alt, text)
    if match_alt:
        return match_alt.group(1)
    
    return None


def extract_ticket_electronico(text: str) -> Optional[str]:
    """
    Extrae el número largo después de la palabra 'CAE'.
    Ejemplo: "CAE 74454216986289" -> "74454216986289"
    """
    pattern = r'CAE\s+(\d+)'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def extract_id_boleta(text: str) -> Optional[str]:
    """
    Extrae el número después de 'Nro T.'.
    Ejemplo: "Nro T. 00142012" -> "00142012"
    """
    patterns = [
        r'Nro\s+T\.?\s+(\d+)',
        r'Nro\s+Ticket\s+(\d+)',
        r'Ticket\s+N°?\s*(\d+)',
        r'Factura\s+N°?\s*(\d+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    
    return None


def _parse_amount_string(amount_str: str) -> Optional[float]:
    """
    Convierte string de monto a float, manejando formatos con comas y puntos.
    Ejemplos: "2690,00" -> 2690.00, "2.690,00" -> 2690.00, "2690.00" -> 2690.00
    """
    try:
        # Si tiene coma, asumir formato europeo (punto para miles, coma para decimales)
        if ',' in amount_str:
            # Remover puntos (separadores de miles) y reemplazar coma por punto
            amount_str = amount_str.replace('.', '').replace(',', '.')
        # Si solo tiene puntos, verificar si es decimal o separador de miles
        elif '.' in amount_str:
            parts = amount_str.split('.')
            # Si la última parte tiene 2 dígitos, es decimal
            if len(parts) > 1 and len(parts[-1]) == 2:
                # Formato con punto decimal
                pass
            else:
                # Formato con punto como separador de miles
                amount_str = amount_str.replace('.', '')
        
        return float(amount_str)
    except ValueError:
        return None


def extract_monto_op_gravada(text: str) -> Optional[float]:
    """
    Extrae el valor numérico de la línea 'SUBTOTAL SIN DESCUENTOS' o 'TOTAL'.
    Ejemplo: "SUBTOTAL SIN DESCUENTOS $ 2690,00" -> 2690.00
    """
    patterns = [
        r'SUBTOTAL\s+SIN\s+DESCUENTOS\s*\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})',
        r'SUBTOTAL\s*\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})',
        r'TOTAL\s*\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            monto_str = match.group(1)
            parsed = _parse_amount_string(monto_str)
            if parsed is not None:
                return parsed
    
    return None


def extract_importe_total(text: str) -> Optional[float]:
    """
    Extrae el valor numérico principal de la línea 'TOTAL'.
    Ejemplo: "TOTAL $ 2690.00" -> 2690.00
    """
    pattern = r'TOTAL\s*\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        monto_str = match.group(1)
        parsed = _parse_amount_string(monto_str)
        if parsed is not None:
            return parsed
    
    # Si no se encuentra, usar el mismo que monto_op_gravada
    return extract_monto_op_gravada(text)


def extract_a_c(text: str) -> Optional[str]:
    """
    Extrae el código al final de la línea que contiene 'Art:'.
    Ejemplo: "... AC-04" -> "AC-04"
    """
    pattern = r'Art:?\s*.*?([A-Z]{1,3}-\d{1,3})'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Buscar patrón alternativo al final de líneas
    pattern_alt = r'([A-Z]{1,3}-\d{1,3})\s*$'
    lines = text.split('\n')
    for line in lines:
        match_alt = re.search(pattern_alt, line)
        if match_alt:
            return match_alt.group(1)
    
    return None


def parse_structured_data(structured_data: list) -> Dict:
    """
    Parsea datos estructurados en formato array de objetos con 'clave' y 'valor'.
    
    Args:
        structured_data: Lista de objetos con formato [{"clave": "...", "valor": "..."}, ...]
        
    Returns:
        Diccionario con todos los campos mapeados según el esquema de BigQuery
    """
    # Convertir array a diccionario para fácil acceso
    data_dict = {}
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Procesando {len(structured_data)} items del array estructurado")
    
    for item in structured_data:
        if isinstance(item, dict) and 'clave' in item and 'valor' in item:
            clave = item['clave'].lower().strip()
            valor = item['valor']
            data_dict[clave] = valor
            logger.info(f"  - Mapeado: {clave} = {valor}")
    
    logger.info(f"Total de campos mapeados: {len(data_dict)}")
    logger.info(f"Campos: {list(data_dict.keys())}")
    
    # Extraer fecha y hora para campos derivados
    fecha_str = None
    hora_str = None
    
    # Mapear campos del formato estructurado al esquema de BigQuery
    if 'fecha' in data_dict:
        fecha_str = str(data_dict['fecha']).strip()
        # Asegurar formato YYYY-MM-DD
        try:
            # Si viene en formato YYYY-MM-DD, validar
            datetime.strptime(fecha_str, '%Y-%m-%d')
        except ValueError:
            # Intentar otros formatos
            try:
                fecha_obj = datetime.strptime(fecha_str, '%d/%m/%Y')
                fecha_str = fecha_obj.strftime('%Y-%m-%d')
            except ValueError:
                try:
                    fecha_obj = datetime.strptime(fecha_str, '%d-%m-%Y')
                    fecha_str = fecha_obj.strftime('%Y-%m-%d')
                except ValueError:
                    fecha_str = None
    
    if 'hora' in data_dict:
        hora_str = str(data_dict['hora']).strip()
        # Asegurar formato HH:MM:SS
        if ':' in hora_str:
            parts = hora_str.split(':')
            if len(parts) == 2:
                hora_str = f"{parts[0]}:{parts[1]}:00"
            elif len(parts) == 3:
                hora_str = hora_str
            else:
                hora_str = None
        else:
            hora_str = None
    
    # Calcular campos derivados
    mes = None
    anio = None
    momento = None
    
    if fecha_str:
        try:
            fecha_obj = datetime.strptime(fecha_str, '%Y-%m-%d')
            mes = fecha_obj.month
            anio = fecha_obj.year
            
            # Construir momento (DATETIME) con la hora original
            if hora_str:
                momento = f"{fecha_str}T{hora_str}"
            else:
                momento = f"{fecha_str}T00:00:00"
        except ValueError:
            pass
    
    # Generar id_check (UUID v4)
    id_check = str(uuid.uuid4())
    
    # Mapear campos específicos (asegurar que sean strings)
    tienda_nombre_raw = data_dict.get('competidor') or data_dict.get('tienda_nombre')
    tienda_nombre = str(tienda_nombre_raw) if tienda_nombre_raw is not None else None
    
    codigo_tienda_raw = data_dict.get('local') or data_dict.get('codigo_tienda')
    codigo_tienda = str(codigo_tienda_raw) if codigo_tienda_raw is not None else None
    
    canal_raw = data_dict.get('canal_de_venta') or data_dict.get('canal')
    canal = str(canal_raw) if canal_raw is not None else None
    
    # Mapear importe_total
    importe_total = 0.0
    if 'importe_total' in data_dict:
        try:
            importe_total = float(data_dict['importe_total'])
        except (ValueError, TypeError):
            importe_total = 0.0
    
    # Mapear número de ticket (asegurar que sea string)
    id_boleta_raw = data_dict.get('numero_de_ticket') or data_dict.get('id_boleta')
    id_boleta = str(id_boleta_raw) if id_boleta_raw is not None else None
    
    ticket_electronico_raw = data_dict.get('ticket_electronico')
    ticket_electronico = str(ticket_electronico_raw) if ticket_electronico_raw is not None else None
    
    # Construir objeto mapeado
    id_caja_raw = data_dict.get('id_caja')
    id_caja = str(id_caja_raw) if id_caja_raw is not None else None
    
    # Mapear recargo_consumo
    recargo_consumo = 0.0
    if 'recargo_consumo' in data_dict:
        try:
            recargo_consumo = float(data_dict['recargo_consumo'])
        except (ValueError, TypeError):
            recargo_consumo = 0.0
    
    # Mapear monto_tarifario
    monto_tarifario = 0.0
    if 'monto_tarifario' in data_dict:
        try:
            monto_tarifario = float(data_dict['monto_tarifario'])
        except (ValueError, TypeError):
            monto_tarifario = 0.0
    
    mapped_data = {
        "id_caja": id_caja,
        "canal": canal,
        "codigo_tienda": codigo_tienda,
        "tienda_nombre": tienda_nombre,
        "fecha": fecha_str,
        "hora": hora_str,
        "ticket_electronico": ticket_electronico,
        "id_boleta": id_boleta,
        "id_check": id_check,
        "monto_op_gravada": importe_total,  # Por defecto igual al importe_total
        "importe_total": importe_total,
        "recargo_consumo": recargo_consumo,  # Extraído del data_dict o 0.0 por defecto
        "monto_tarifario": monto_tarifario,  # Extraído del data_dict o 0.0 por defecto
        "mes": mes,
        "anio": anio,
        "momento": momento,
        "a_c": data_dict.get('a_c') or None
    }
    
    return mapped_data


def parse_and_map_invoice(raw_text: str) -> Dict:
    """
    Función principal que parsea el texto y mapea todos los campos al esquema de BigQuery.
    
    Args:
        raw_text: Texto crudo extraído por OCR
        
    Returns:
        Diccionario con todos los campos mapeados según el esquema de BigQuery
    """
    if not raw_text:
        raw_text = ""
    
    # Normalizar el texto
    normalized_text = raw_text.replace('\\n', '\n')
    
    # Extraer fecha y hora para campos derivados
    fecha_str = extract_fecha(normalized_text)
    hora_str = extract_hora(normalized_text)
    
    # Calcular campos derivados
    mes = None
    anio = None
    momento = None
    
    if fecha_str:
        try:
            fecha_obj = datetime.strptime(fecha_str, '%Y-%m-%d')
            mes = fecha_obj.month
            anio = fecha_obj.year
            
            # Construir momento (DATETIME)
            if hora_str:
                momento_str = f"{fecha_str}T{hora_str}"
                momento = momento_str
            else:
                momento = f"{fecha_str}T00:00:00"
        except ValueError:
            pass
    
    # Generar id_check (UUID v4)
    id_check = str(uuid.uuid4())
    
    # Extraer montos
    monto_op_gravada = extract_monto_op_gravada(normalized_text)
    importe_total = extract_importe_total(normalized_text)
    
    # Construir objeto mapeado
    mapped_data = {
        "id_caja": extract_id_caja(normalized_text),
        "canal": None,  # Se llenará en el frontend
        "codigo_tienda": extract_codigo_tienda(normalized_text),
        "tienda_nombre": extract_tienda_nombre(normalized_text),
        "fecha": fecha_str,
        "hora": hora_str,
        "ticket_electronico": extract_ticket_electronico(normalized_text),
        "id_boleta": extract_id_boleta(normalized_text),
        "id_check": id_check,
        "monto_op_gravada": monto_op_gravada if monto_op_gravada is not None else 0.0,
        "importe_total": importe_total if importe_total is not None else 0.0,
        "recargo_consumo": 0.0,  # Valor por defecto
        "monto_tarifario": 0.0,  # Valor por defecto
        "mes": mes,
        "anio": anio,
        "momento": momento,
        "a_c": extract_a_c(normalized_text)
    }
    
    return mapped_data
