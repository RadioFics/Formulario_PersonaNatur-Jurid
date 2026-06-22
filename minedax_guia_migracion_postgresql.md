# MineDax → PostgreSQL: Guía Completa de Migración
**Fecha:** Junio 2026 | **Entorno:** Windows Server, intranet sin internet, sin Azure

---

## 1. ¿Es PostgreSQL completamente gratuito?

**Sí, 100 % gratuito y sin restricciones para producción.** La licencia de PostgreSQL es similar a MIT: puedes usarlo, modificarlo y desplegarlo en producción sin pagar nada, sin límite de tamaño de base de datos, sin límite de conexiones, sin funcionalidades bloqueadas por edición.

Comparado con lo que tienes hoy:

| Característica | SQL Server Express (actual) | PostgreSQL 17 (destino) |
|---|---|---|
| Costo | Gratis pero limitado | Gratis sin límites |
| Tamaño máximo BD | **10 GB** | Ilimitado |
| RAM utilizable | **1 GB buffer pool** | Toda la RAM del servidor |
| CPU | **1 socket** | Sin límite |
| Jobs programados | No (sin SQL Agent) | Sí (pg_cron, gratuito) |
| Cifrado en reposo | No habilitado | Nativo configurable |
| Linux/Windows | Solo Windows | Ambos |
| Soporte Azure necesario | Sí para la nube | No aplica |

**Herramientas gratuitas incluidas:**
- **pgAdmin 4** – interfaz gráfica equivalente a SSMS, web-based, corre en el mismo servidor
- **psql** – cliente de línea de comandos incluido
- **pg_dump / pg_restore** – backup y restauración nativos
- **pgaudit** – auditoría a nivel de motor (extensión gratuita)
- **pg_cron** – jobs programados (extensión gratuita)

---

## 2. Instalación Offline en Windows Server

### 2.1 Qué descargar (desde una máquina CON internet)

Descargar todos estos archivos y copiarlos al servidor de intranet por USB, carpeta compartida o cualquier medio disponible:

| Archivo | URL de descarga | Para qué sirve |
|---|---|---|
| `postgresql-17.x-windows-x64.exe` | https://www.postgresql.org/download/windows/ | PostgreSQL + pgAdmin 4 (todo incluido) |
| `vc_redist.x64.exe` | https://aka.ms/vs/17/release/vc_redist.x64.exe | Visual C++ Runtime (dependencia) |
| `python-3.12.x-amd64.exe` | https://www.python.org/downloads/ | Para el script de migración |
| `pyodbc-5.x.x-cpXXX-win_amd64.whl` | https://pypi.org/project/pyodbc/#files | Conector Python → SQL Server |
| `psycopg2_binary-2.9.x-cpXXX-win_amd64.whl` | https://pypi.org/project/psycopg2-binary/#files | Conector Python → PostgreSQL |
| `odbc_driver_17_for_sql_server.msi` | https://aka.ms/downloadmsodbcsql | ODBC Driver para SQL Server |

> **Nota sobre wheels (.whl):** Descargar la versión que corresponda a tu versión de Python (cp312 = Python 3.12) y arquitectura (win_amd64 = Windows 64-bit).

### 2.2 Instalación paso a paso (en el servidor de intranet)

**Paso 1 – Visual C++ Runtime**
```
Ejecutar: vc_redist.x64.exe
Aceptar licencia → Instalar → Reiniciar si se pide
```

**Paso 2 – PostgreSQL**
```
Ejecutar: postgresql-17.x-windows-x64.exe como Administrador

Opciones de instalación:
  ✓ PostgreSQL Server
  ✓ pgAdmin 4
  ✓ Command Line Tools
  ✓ Stack Builder → NO (requiere internet)

Directorio: C:\Program Files\PostgreSQL\17  (o el que prefieras)
Puerto: 5432  (dejar el default)
Contraseña superusuario: [ESTABLECER UNA CONTRASEÑA FUERTE]
Locale: Spanish, Colombia
```

**Paso 3 – Crear la base de datos MineDax**

Abrir pgAdmin 4 (se instala como aplicación web local en http://localhost):
```sql
-- En pgAdmin: click derecho en Databases → Create → Database
-- Name: minedax
-- Owner: postgres
-- Encoding: UTF8
-- Collation: es_CO.UTF-8  (o C si da error, ajustable después)
```

O desde línea de comandos (PowerShell como Admin):
```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE minedax ENCODING 'UTF8';"
```

**Paso 4 – Habilitar extensiones necesarias**
```sql
-- Ejecutar en pgAdmin Query Tool sobre la BD minedax:
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- Para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_cron;    -- Para jobs programados
CREATE EXTENSION IF NOT EXISTS pgaudit;    -- Para auditoría avanzada
```

**Paso 5 – Ejecutar el DDL**
```
En pgAdmin → Query Tool → Abrir archivo minedax_postgresql_ddl.sql → Ejecutar (F5)
```
Esto crea las 68 tablas, índices, esquemas sec y nomina, y las políticas RLS de auditoría.

**Paso 6 – Instalar Python y dependencias (offline)**
```powershell
# Instalar Python
python-3.12.x-amd64.exe /quiet InstallAllUsers=1 PrependPath=1

# Instalar ODBC Driver para SQL Server
msiexec /i odbc_driver_17_for_sql_server.msi /quiet

# Instalar librerías desde archivos .whl descargados
pip install pyodbc-5.x.x-cpXXX-win_amd64.whl
pip install psycopg2_binary-2.9.x-cpXXX-win_amd64.whl
```

### 2.3 Configurar PostgreSQL para acceso en intranet

Editar `C:\Program Files\PostgreSQL\17\data\postgresql.conf`:
```ini
listen_addresses = '*'        # Escuchar en todas las interfaces de red
port = 5432
max_connections = 100
shared_buffers = 256MB        # Ajustar según RAM del servidor (25% de RAM)
```

Editar `C:\Program Files\PostgreSQL\17\data\pg_hba.conf` (control de acceso):
```
# Tipo    Base    Usuario    Dirección de red intranet      Método
host      all     all        192.168.1.0/24                 scram-sha-256
```
Reemplazar `192.168.1.0/24` con el rango de IPs de tu intranet.

Reiniciar el servicio:
```powershell
Restart-Service postgresql-x64-17
```

---

## 3. Proceso de Migración de Datos

### 3.1 Configurar el script de migración

Abrir `minedax_migration_script.py` y ajustar:
```python
# SQL Server (origen) — ya está preconfigurado con CM-ITD-P-05\SQLEXPRESS
MSSQL_CONN = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=CM-ITD-P-05\SQLEXPRESS;..."

# PostgreSQL (destino)
PG_CONN = dict(
    host="192.168.X.X",    # IP del servidor PostgreSQL en intranet
    port=5432,
    dbname="minedax",
    user="postgres",
    password="TU_CLAVE",
)
```

### 3.2 Ejecutar migración

**Primero, prueba en seco (dry_run = True):**
```powershell
python minedax_migration_script.py
# Muestra conteo de filas por tabla sin insertar nada
```

**Luego, migración real (dry_run = False en el script):**
```powershell
python minedax_migration_script.py
# Migra tabla por tabla en orden seguro (MAE → GN → NO → SEC)
```

### 3.3 Orden de migración y por qué importa

```
1. MAE_* (Maestras)  → primero, porque todo el sistema las referencia
2. GN_*  (Generales) → segundo, dependen de maestras
3. NO_*  (Nómina)    → tercero, dependen de GN_ y MAE_
4. SEC.* (Auditoría) → último, registros históricos independientes
```

### 3.4 Validación post-migración

Ejecutar en pgAdmin para verificar conteos:
```sql
-- Comparar totales entre SQL Server y PostgreSQL
SELECT schemaname, tablename, n_live_tup AS filas
FROM pg_stat_user_tables
ORDER BY schemaname, tablename;
```

---

## 4. ENUMs vs Tablas Maestras en PostgreSQL

### ¿Cuándo usar cada uno?

**PostgreSQL ENUM** — para valores fijos, cortos, que raramente cambian:
```sql
-- En MineDax aplica a: ACT_ESTA, IND_ACT, TIPO_OP, RESULTADO
CREATE TYPE estado_registro AS ENUM ('A', 'I', 'P', 'C', 'R');
CREATE TYPE resultado_evento AS ENUM ('S', 'F', 'W');
CREATE TYPE tipo_operacion   AS ENUM ('I', 'U', 'D');

-- Ventajas: validación automática, índices más eficientes,
--           0 bytes de almacenamiento extra vs JOIN a tabla maestra
```

**Tabla maestra (MAE_*)** — para catálogos que sí crecen o necesitan exportarse:
```sql
-- MAE_PAIS, MAE_DEPT, MAE_MUNI, MAE_BANCO, MAE_AFP, MAE_EPS, etc.
-- Ventajas: puedes agregar/modificar valores sin ALTER TYPE,
--           puedes enriquecer con más columnas (descripción, código externo, etc.)
```

### Exportación de información faltante con tablas maestras

Las tablas MAE_* en PostgreSQL se benefician de:

```sql
-- JSONB para almacenar datos de fuentes externas sin columnas fijas
ALTER TABLE public."MAE_PAIS" ADD COLUMN datos_externos JSONB;

-- Ejemplo: enriquecer MAE_PAIS con datos de API DIAN/DANE
UPDATE public."MAE_PAIS"
SET datos_externos = '{"codigo_iso": "CO", "gentilicio": "colombiano", "moneda": "COP"}'::jsonb
WHERE "COD_PAIS" = 1;

-- Buscar dentro del JSON sin JOIN
SELECT * FROM public."MAE_PAIS"
WHERE datos_externos->>'codigo_iso' = 'CO';
```

---

## 5. Inteligencia Artificial para Depuración de Datos

### 5.1 Datos fantasma y registros erróneos

PostgreSQL ofrece dos enfoques para depurar con IA:

**Enfoque 1: Python + modelo de lenguaje local (sin internet, offline)**

Usar `ollama` con un modelo pequeño (llama3, mistral) instalado en el servidor:
```python
import ollama, psycopg2

# Detectar nombres con posibles errores ortográficos
def verificar_nombre(nombre):
    resp = ollama.chat(model='llama3', messages=[{
        'role': 'user',
        'content': f'El siguiente nombre de empresa tiene errores ortográficos o está desactualizado? Responde solo SI o NO y la corrección si aplica: "{nombre}"'
    }])
    return resp['message']['content']

# Aplicar sobre MAE_TERC
conn = psycopg2.connect(...)
cur  = conn.cursor()
cur.execute('SELECT "COD_TERC", "NOM_COMP" FROM public."MAE_TERC" WHERE "ACT_ESTA"=\'A\'')
for cod, nom in cur.fetchall():
    resultado = verificar_nombre(nom)
    print(f"{cod}: {nom} → {resultado}")
```

**Enfoque 2: Fuzzy matching con `pg_trgm` (extensión nativa PostgreSQL)**

Sin IA externa, detecta duplicados y errores tipográficos:
```sql
-- Habilitar extensión de similitud de texto
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Encontrar posibles duplicados en MAE_TERC
SELECT a."COD_TERC", a."NOM_COMP", b."COD_TERC", b."NOM_COMP",
       similarity(a."NOM_COMP", b."NOM_COMP") AS sim
FROM public."MAE_TERC" a
JOIN public."MAE_TERC" b
  ON a."COD_TERC" < b."COD_TERC"
 AND similarity(a."NOM_COMP", b."NOM_COMP") > 0.7  -- 70%+ similitud
ORDER BY sim DESC;

-- Encontrar términos desactualizados con búsqueda fonética
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
SELECT "COD_TERC", "NOM_COMP"
FROM public."MAE_TERC"
WHERE dmetaphone("NOM_COMP") = dmetaphone('Sociedad Anonima');
```

**Enfoque 3: Script de limpieza automatizado**

```python
import re, psycopg2

CORRECCIONES = {
    r'\bS\.A\.S\b': 'S.A.S.',
    r'\bLTDA\b': 'LTDA.',
    r'\bS\.A\b': 'S.A.',
    r'\bCIA\b': 'CÍA.',
    r'\bEU\b': 'E.U.',
    # Agregar más reglas según los errores encontrados
}

def limpiar_nombre(texto):
    if not texto:
        return texto
    t = texto.strip().upper()
    for patron, reemplazo in CORRECCIONES.items():
        t = re.sub(patron, reemplazo, t, flags=re.IGNORECASE)
    return t

# Aplicar y generar reporte ANTES de modificar
conn = psycopg2.connect(...)
cur = conn.cursor()
cur.execute('SELECT "COD_TERC", "NOM_COMP" FROM public."MAE_TERC"')
cambios = []
for cod, nom in cur.fetchall():
    limpio = limpiar_nombre(nom)
    if limpio != nom:
        cambios.append((cod, nom, limpio))

print(f"Registros con cambios potenciales: {len(cambios)}")
for cod, orig, nuevo in cambios[:20]:
    print(f"  {cod}: '{orig}' → '{nuevo}'")
```

---

## 6. Trazabilidad Mejorada en PostgreSQL

### 6.1 Configurar pgaudit (nivel de motor)

En `postgresql.conf`:
```ini
shared_preload_libraries = 'pgaudit'
pgaudit.log = 'write, ddl'    # Registra INSERT, UPDATE, DELETE, CREATE, ALTER, DROP
pgaudit.log_relation = on     # Incluye nombre de tabla en cada log
pgaudit.log_parameter = on    # Incluye valores de parámetros
```

Esto registra **incluso operaciones de superusuario**, a diferencia de los triggers actuales en SQL Server.

### 6.2 Tablas de auditoría con período de retención

```sql
-- Tabla de auditoría con particionamiento por mes (PostgreSQL 10+)
CREATE TABLE sec."AUDIT_LOG" (
    "ID_LOG"      BIGSERIAL,
    "FECHA_HORA"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NOM_USUA"    VARCHAR(100),
    "ROL_USUA"    VARCHAR(50),
    "IP_ORIGEN"   VARCHAR(45),
    "TIPO_EVENTO" VARCHAR(50),
    "NOM_TABLA"   VARCHAR(100),
    "DETALLE"     TEXT,
    "RESULTADO"   CHAR(1)
) PARTITION BY RANGE ("FECHA_HORA");

-- Crear particiones por año
CREATE TABLE sec."AUDIT_LOG_2025" PARTITION OF sec."AUDIT_LOG"
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE sec."AUDIT_LOG_2026" PARTITION OF sec."AUDIT_LOG"
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

---

## 7. Resumen de Costos

| Componente | Costo |
|---|---|
| PostgreSQL 17 | **$0** |
| pgAdmin 4 | **$0** |
| pgaudit, pg_cron, pg_trgm | **$0** |
| Python + psycopg2 + pyodbc | **$0** |
| Windows Server (ya tienes) | $0 adicional |
| **TOTAL** | **$0** |

Única inversión: tiempo de configuración e instalación (~2-4 horas para un servidor limpio).

---

## 8. Próximos pasos recomendados

1. **[Inmediato]** Descargar instalador PostgreSQL en máquina con internet
2. **[Día 1]** Instalar PostgreSQL en servidor de intranet con esta guía
3. **[Día 1]** Ejecutar `minedax_postgresql_ddl.sql` para crear estructura
4. **[Día 2]** Ejecutar `minedax_migration_script.py` en modo dry_run para validar conteos
5. **[Día 2]** Ejecutar migración real y validar con pg_stat_user_tables
6. **[Día 3]** Configurar pgaudit + pg_cron + RLS en tablas de auditoría
7. **[Día 3]** Actualizar cadenas de conexión de la aplicación hacia PostgreSQL
8. **[Semana 2]** Ejecutar scripts de limpieza con pg_trgm sobre MAE_TERC y GN_TERCE
9. **[Semana 2]** Agregar FKs después de confirmar integridad referencial

---

*Archivos generados:*
- `minedax_postgresql_ddl.sql` — DDL completo, 68 tablas, listo para ejecutar
- `minedax_migration_script.py` — Script Python de migración con dry_run
- `minedax_guia_migracion_postgresql.md` — Esta guía
