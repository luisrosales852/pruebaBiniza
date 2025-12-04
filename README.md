# Firebase Functions - Question Generator

Sistema de generación automática de preguntas educativas usando Google Gemini AI y Docling API para procesamiento de documentos.

## 📋 Características

-  Generación de preguntas desde texto plano
-  Generación de preguntas desde chunks pre-procesados
-  **Procesamiento de documentos (PDF, Word, etc.)** mediante Docling API
-  Soporte para múltiples niveles educativos (K-12, College, etc.)
-  Taxonomías Bloom y DOK
-  Tipos de pregunta: Multiple Choice, Open Text, Numerical
-  Metadata de fuente (chunk ID, página, tipo)

## 🔧 Prerequisitos

- Node.js 24.x o superior
- npm 10.x o superior
- Firebase CLI: `npm install -g firebase-tools`
- Cuenta de Firebase (proyecto: cuwiproject)
- Google Gemini API Key
- Docling API Key (para procesamiento de documentos)

## 📦 Instalación

### 1. Clonar e instalar dependencias

```bash
cd functions
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus API keys:
```env
GEMINI_API_KEY=tu_key_de_gemini
DOCLING_API_URL=https://api.docling.io/v1
DOCLING_API_KEY=tu_key_de_docling
```



#### Obtener Docling API Key:

⚠️ **IMPORTANTE:** Docling puede no ser un servicio público disponible. Si no puedes acceder a Docling, considera estas alternativas:

**Servicios alternativos de procesamiento de documentos:**
- **Adobe PDF Services API**: https://developer.adobe.com/document-services/apis/pdf-extract/
- **Google Document AI**: https://cloud.google.com/document-ai
- **Azure Form Recognizer**: https://azure.microsoft.com/en-us/products/ai-services/ai-document-intelligence
- **Amazon Textract**: https://aws.amazon.com/textract/

Si usas un servicio alternativo, necesitarás:
1. Adaptar la función `callDoclingAPI` en `src/index.ts` para la API del servicio elegido
2. Ajustar las interfaces según el formato de respuesta del servicio
3. Actualizar la documentación con los pasos específicos

### 3. Compilar TypeScript

```bash
npm run build
```

## 🚀 Desarrollo Local

### Iniciar emuladores de Firebase

```bash
npm run serve
```

Funciones disponibles en:
- http://localhost:5001/cuwiproject/us-central1/helloWorld
- http://localhost:5001/cuwiproject/us-central1/generateQuestions
- http://localhost:5001/cuwiproject/us-central1/generateQuestionsFromChunks
- http://localhost:5001/cuwiproject/us-central1/generateQuestionsFromDocument

### Compilar en modo watch

```bash
npm run build:watch
```

## 📚 API Reference

### 1. generateQuestions

Genera preguntas desde texto plano.

**Endpoint:** `POST /generateQuestions`

**Parámetros del Body:**

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| content | string | ✅ Sí | - | Texto del cual generar preguntas |
| educational_level | string | No | "High School" | Nivel educativo |
| subject | string | No | "Ciencias" | Materia o tema |
| context | string | No | "Enfoque práctico" | Contexto educativo |
| number_of_questions | number | No | 3 | Cantidad de preguntas |
| bloom | string | No | "Understand" | Nivel taxonomía Bloom |
| dok | number | No | 2 | Nivel DOK (1-4) |
| question_type | string[] | No | ["Multiple choice"] | Tipos de pregunta |

**Ejemplo de Request:**

```json
{
  "content": "El sistema solar está formado por el Sol y ocho planetas. Los planetas interiores (Mercurio, Venus, Tierra y Marte) son rocosos, mientras que los exteriores (Júpiter, Saturno, Urano y Neptuno) son gigantes gaseosos.",
  "educational_level": "High School",
  "subject": "Astronomía",
  "number_of_questions": 3,
  "bloom": "Understand",
  "dok": 2,
  "question_type": ["Multiple choice"]
}
```

**Ejemplo de Response:**

```json
{
  "success": true,
  "metadata": {
    "educational_level": "High School",
    "subject": "Astronomía",
    "bloom": "Understand",
    "dok": 2,
    "question_types": ["Multiple choice"],
    "total_questions": 3
  },
  "data": {
    "questions": [
      {
        "question": "¿Cuál es el planeta más grande del sistema solar?",
        "options": [
          {
            "id": 1,
            "description": "Júpiter",
            "explanation": "Correcto. Júpiter es el planeta más grande con un diámetro de 139,820 km."
          },
          {
            "id": 2,
            "description": "Saturno",
            "explanation": "Incorrecto. Saturno es el segundo más grande."
          },
          {
            "id": 3,
            "description": "Neptuno",
            "explanation": "Incorrecto. Neptuno es mucho más pequeño que Júpiter."
          },
          {
            "id": 4,
            "description": "Tierra",
            "explanation": "Incorrecto. La Tierra es un planeta pequeño."
          }
        ],
        "answer": 1,
        "configuration": {
          "open": false,
          "numerical": false,
          "case_sensitive": false
        }
      }
    ]
  }
}
```

### 2. generateQuestionsFromChunks

Genera preguntas desde chunks pre-procesados.

**Endpoint:** `POST /generateQuestionsFromChunks`

**Parámetros del Body:**

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| chunks | Chunk[] | ✅ Sí | - | Array de chunks de contenido |
| educational_level | string | No | "High School" | Nivel educativo |
| subject | string | No | "Ciencias" | Materia o tema |
| context | string | No | "Enfoque práctico" | Contexto educativo |
| number_of_questions | number | No | 10 | Cantidad total de preguntas |
| bloom | string | No | "Understand" | Nivel taxonomía Bloom |
| dok | number | No | 2 | Nivel DOK (1-4) |
| question_type | string[] | No | ["Multiple choice"] | Tipos de pregunta |

**Estructura de Chunk:**

```typescript
{
  id: string;              // Identificador único del chunk
  type: "title" | "paragraph" | "table" | "list";
  text: string;            // Contenido del chunk
  page?: number;           // Número de página (opcional)
}
```

**Ejemplo de Request:**

```json
{
  "chunks": [
    {
      "id": "c1",
      "type": "paragraph",
      "text": "El sistema solar está formado por el Sol...",
      "page": 1
    },
    {
      "id": "c2",
      "type": "paragraph",
      "text": "Los planetas interiores son rocosos...",
      "page": 2
    }
  ],
  "educational_level": "High School",
  "subject": "Astronomía",
  "number_of_questions": 5,
  "bloom": "Apply",
  "dok": 2,
  "question_type": ["Multiple choice", "Open text"]
}
```

**Ejemplo de Response:**

```json
{
  "success": true,
  "metadata": {
    "source": "chunks_processing",
    "educational_level": "High School",
    "subject": "Astronomía",
    "bloom": "Apply",
    "dok": 2,
    "question_types": ["Multiple choice", "Open text"],
    "total_questions": 5,
    "total_chunks": 2,
    "chunk_results": [
      { "chunk_id": "c1", "questions_generated": 3, "status": "success" },
      { "chunk_id": "c2", "questions_generated": 2, "status": "success" }
    ]
  },
  "data": {
    "questions": [
      {
        "question": "¿Cuál es...?",
        "options": [...],
        "answer": 1,
        "configuration": {...},
        "source": {
          "chunk_id": "c1",
          "chunk_type": "paragraph",
          "page": 1
        }
      }
    ]
  }
}
```

### 3. generateQuestionsFromDocument

Procesa un documento con Docling API y genera preguntas automáticamente.

**Endpoint:** `POST /generateQuestionsFromDocument`

**Parámetros del Body:**

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| document_url | string | ⚠️ Uno requerido | - | URL del documento a procesar |
| document_file | string | ⚠️ Uno requerido | - | Documento en base64 |
| educational_level | string | No | "High School" | Nivel educativo |
| subject | string | No | "General" | Materia o tema |
| context | string | No | "Enfoque práctico" | Contexto educativo |
| number_of_questions | number | No | 10 | Cantidad total de preguntas |
| bloom | string | No | "Understand" | Nivel taxonomía Bloom |
| dok | number | No | 2 | Nivel DOK (1-4) |
| question_type | string[] | No | ["Multiple choice"] | Tipos de pregunta |

⚠️ **Nota:** Debe proporcionar `document_url` O `document_file`, no ambos.

**Opción A - Desde URL:**

```json
{
  "document_url": "https://example.com/document.pdf",
  "educational_level": "College",
  "subject": "Biology",
  "number_of_questions": 10,
  "bloom": "Analyze",
  "dok": 3,
  "question_type": ["Multiple choice"]
}
```

**Opción B - Archivo base64:**

```json
{
  "document_file": "data:application/pdf;base64,JVBERi0xLjQK...",
  "educational_level": "Middle School",
  "subject": "Mathematics",
  "number_of_questions": 5,
  "bloom": "Understand",
  "dok": 2,
  "question_type": ["Open text"]
}
```

**Ejemplo de Response:**

```json
{
  "success": true,
  "metadata": {
    "source": "docling_processing",
    "document_url": "https://example.com/document.pdf",
    "educational_level": "College",
    "subject": "Biology",
    "bloom": "Analyze",
    "dok": 3,
    "question_types": ["Multiple choice"],
    "total_questions": 10,
    "total_chunks": 8,
    "chunk_results": [
      { "chunk_id": "chunk_1", "questions_generated": 2, "status": "success" },
      { "chunk_id": "chunk_2", "questions_generated": 1, "status": "success" },
      { "chunk_id": "chunk_3", "questions_generated": 2, "status": "success" }
    ]
  },
  "data": {
    "questions": [
      {
        "question": "¿Cuál es la función principal del ATP en la célula?",
        "options": [
          {
            "id": 1,
            "description": "Almacenar y transferir energía",
            "explanation": "Correcto. El ATP es la moneda energética de la célula."
          },
          {
            "id": 2,
            "description": "Sintetizar proteínas",
            "explanation": "Incorrecto. Esa es función de los ribosomas."
          },
          {
            "id": 3,
            "description": "Almacenar información genética",
            "explanation": "Incorrecto. Esa es función del ADN."
          },
          {
            "id": 4,
            "description": "Regular el pH celular",
            "explanation": "Incorrecto. El ATP no tiene esa función principal."
          }
        ],
        "answer": 1,
        "configuration": {
          "open": false,
          "numerical": false,
          "case_sensitive": false
        },
        "source": {
          "chunk_id": "chunk_1",
          "chunk_type": "paragraph",
          "page": 1
        }
      }
    ]
  }
}
```

## 💡 Ejemplos de Uso

### Usando curl

#### 1. Texto plano

```bash
curl -X POST http://localhost:5001/cuwiproject/us-central1/generateQuestions \
  -H "Content-Type: application/json" \
  -d '{
    "content": "La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar en energía. Durante este proceso, las plantas absorben dióxido de carbono y liberan oxígeno.",
    "educational_level": "Middle School",
    "subject": "Biología",
    "number_of_questions": 2,
    "bloom": "Understand",
    "dok": 2,
    "question_type": ["Multiple choice"]
  }'
```

#### 2. Documento desde URL

```bash
curl -X POST http://localhost:5001/cuwiproject/us-central1/generateQuestionsFromDocument \
  -H "Content-Type: application/json" \
  -d '{
    "document_url": "https://arxiv.org/pdf/2301.00001.pdf",
    "educational_level": "College",
    "subject": "Computer Science",
    "number_of_questions": 5,
    "bloom": "Apply",
    "dok": 3,
    "question_type": ["Multiple choice", "Open text"]
  }'
```

#### 3. Chunks pre-procesados

```bash
curl -X POST http://localhost:5001/cuwiproject/us-central1/generateQuestionsFromChunks \
  -H "Content-Type: application/json" \
  -d '{
    "chunks": [
      {
        "id": "intro",
        "type": "paragraph",
        "text": "La programación orientada a objetos es un paradigma...",
        "page": 1
      }
    ],
    "number_of_questions": 3,
    "bloom": "Remember",
    "dok": 1
  }'
```

### Usando Postman

#### Configuración básica:

1. **Crear nueva request:**
   - Method: POST
   - URL: `http://localhost:5001/cuwiproject/us-central1/generateQuestionsFromDocument`

2. **Headers:**
   - Key: Content-Type
   - Value: application/json

3. **Body (seleccionar "raw" y "JSON"):**
   ```json
   {
     "document_url": "https://example.com/doc.pdf",
     "educational_level": "High School",
     "number_of_questions": 3,
     "bloom": "Remember",
     "dok": 1,
     "question_type": ["Multiple choice"]
   }
   ```

4. **Click "Send"** y revisar la respuesta

##  Manejo de Errores

### Códigos de respuesta HTTP

| Código | Nombre | Descripción |
|--------|--------|-------------|
| 200 | Success | Operación exitosa |
| 400 | Bad Request | Parámetros inválidos o faltantes |
| 401 | Unauthorized | API key inválida o faltante |
| 422 | Unprocessable Entity | Contenido vacío o respuesta inválida |
| 429 | Too Many Requests | Rate limit de API excedido |
| 500 | Internal Server Error | Error del servidor |
| 503 | Service Unavailable | Servicio externo no disponible |

### Ejemplos de errores

#### Contenido vacío:

```json
{
  "success": false,
  "error": "El campo 'content' es requerido y debe ser un string no vacío"
}
```

#### Contenido muy largo:

```json
{
  "success": false,
  "error": "El contenido excede el límite de 50,000 caracteres"
}
```

#### Sin documento:

```json
{
  "success": false,
  "error": "Se requiere 'document_url' o 'document_file'"
}
```

#### Docling API error:

```json
{
  "success": false,
  "error": "Error al procesar el documento con Docling",
  "details": "Docling API error (404): Document not found"
}
```

#### Documento sin contenido:

```json
{
  "success": false,
  "error": "El documento no contiene texto procesable"
}
```

#### Gemini API rate limit:

```json
{
  "success": false,
  "error": "Límite de tasa de Gemini API excedido",
  "details": "Quota exceeded for quota metric..."
}
```

#### Error de autenticación:

```json
{
  "success": false,
  "error": "Error de autenticación con Gemini API",
  "details": "API key not valid"
}
```

### Estrategias de retry

Para errores transitorios (503, 429), implementa exponential backoff:

```javascript
async function retryRequest(url, data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) return await response.json();
      if (response.status !== 429 && response.status !== 503) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }

    // Esperar: 1s, 2s, 4s
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
  }
}
```

## 🚢 Deployment

### Deploy a Firebase

```bash
# Compilar TypeScript
npm run build

# Deploy todas las funciones
firebase deploy --only functions
```

### Deploy función específica

```bash
# Solo la nueva función
firebase deploy --only functions:generateQuestionsFromDocument

# Múltiples funciones
firebase deploy --only functions:generateQuestions,functions:generateQuestionsFromDocument
```

### URLs de producción

Después del deploy, las funciones estarán disponibles en:

- https://us-central1-cuwiproject.cloudfunctions.net/helloWorld
- https://us-central1-cuwiproject.cloudfunctions.net/generateQuestions
- https://us-central1-cuwiproject.cloudfunctions.net/generateQuestionsFromChunks
- https://us-central1-cuwiproject.cloudfunctions.net/generateQuestionsFromDocument

### Configurar variables de entorno en producción

⚠️ **IMPORTANTE:** Las variables de `.env` solo funcionan localmente. En producción, debes configurar las variables así:

```bash
# Configurar variables
firebase functions:config:set gemini.api_key="tu_gemini_key"
firebase functions:config:set docling.api_url="https://api.docling.io/v1"
firebase functions:config:set docling.api_key="tu_docling_key"

# Ver configuración actual
firebase functions:config:get

# Redeploy después de cambiar config
firebase deploy --only functions
```

Luego, actualiza el código en `src/index.ts`:

```typescript
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || functions.config().gemini?.api_key || "";
const DOCLING_API_KEY = process.env.DOCLING_API_KEY || functions.config().docling?.api_key || "";
```

### Verificar deployment

```bash
# Ver logs en tiempo real
firebase functions:log --only generateQuestionsFromDocument

# Ver logs recientes
firebase functions:log
```

## 🔍 Troubleshooting

### Firebase emulator no inicia

**Problema:** Error al iniciar emuladores

**Solución:**
```bash
# Limpiar cache y reinstalar
rm -rf node_modules package-lock.json
npm install
npm run build
npm run serve
```

### Error "GEMINI_API_KEY no está configurada"

**Problema:** La API key no se está leyendo

**Soluciones:**
1. Verificar que `.env` existe en la carpeta `/functions`
2. Verificar que `dotenv.config()` está al inicio del código
3. Verificar que no hay espacios extra en el archivo `.env`
4. Reiniciar el emulator después de cambiar `.env`

```bash
# Verificar contenido del .env
cat .env

# Debe mostrar algo como:
# GEMINI_API_KEY="tu_key_aqui"
```

### Docling API timeout

**Problema:** Documentos grandes tardan demasiado

**Soluciones:**
1. El timeout actual es de 60 segundos. Para aumentarlo, edita `src/index.ts`:
   ```typescript
   timeout: 120000 // 2 minutos
   ```
2. Documentos PDF con muchas imágenes pueden tardar 2-3 minutos
3. Verifica tu conexión a internet
4. Considera dividir documentos grandes en partes más pequeñas

### TypeScript compilation errors

**Problema:** Errores al compilar TypeScript

**Solución:**
```bash
# Verificar errores de sintaxis
npm run lint

# Limpiar build anterior
rm -rf lib/

# Recompilar
npm run build
```

### Logs en producción

```bash
# Ver logs de una función específica
firebase functions:log --only generateQuestionsFromDocument

# Ver logs con filtro
firebase functions:log --only generateQuestionsFromDocument | grep ERROR

# Ver logs en tiempo real
firebase functions:log --only generateQuestionsFromDocument --tail
```

### Error de Node version

**Problema:** Warning sobre Node.js version

```
EBADENGINE Unsupported engine { required: { node: '24' }, current: { node: 'v22.20.0' } }
```

**Solución:**
1. Instalar Node.js 24.x: https://nodejs.org/
2. O cambiar en `package.json`:
   ```json
   "engines": {
     "node": "22"
   }
   ```

## 🧪 Testing Manual

### Test Case 1: Documento Simple

**Objetivo:** Verificar procesamiento básico

**Request:**
```bash
curl -X POST http://localhost:5001/cuwiproject/us-central1/generateQuestionsFromDocument \
  -H "Content-Type: application/json" \
  -d '{
    "document_url": "https://example.com/simple.pdf",
    "educational_level": "High School",
    "number_of_questions": 3
  }'
```

**Validar:**
- ✅ Status code: 200
- ✅ success: true
- ✅ total_questions: 3
- ✅ Cada pregunta tiene source metadata

### Test Case 2: Documento Complejo

**Objetivo:** Verificar procesamiento de PDF con tablas

**Request:**
```bash
curl -X POST http://localhost:5001/cuwiproject/us-central1/generateQuestionsFromDocument \
  -H "Content-Type: application/json" \
  -d '{
    "document_url": "https://arxiv.org/pdf/2301.00001.pdf",
    "educational_level": "College",
    "number_of_questions": 10,
    "bloom": "Analyze",
    "dok": 3,
    "question_type": ["Multiple choice", "Open text"]
  }'
```

**Validar:**
- ✅ Status 200
- ✅ Mezcla de tipos de pregunta
- ✅ chunk_type incluye diferentes tipos si hay tablas/listas
- ✅ Tiempo de respuesta < 2 minutos

### Test Case 3: Función existente sigue funcionando

**Objetivo:** Verificar backward compatibility

**Request:**
```bash
curl -X POST http://localhost:5001/cuwiproject/us-central1/generateQuestions \
  -H "Content-Type: application/json" \
  -d '{
    "content": "La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar en energía.",
    "number_of_questions": 2
  }'
```

**Validar:**
- ✅ Status 200
- ✅ Funciona igual que antes
- ✅ No se rompió nada

## 📊 Parámetros y Configuración

### Niveles Educativos Soportados

- Elementary School
- Middle School
- High School
- College
- Graduate

### Taxonomía de Bloom (bloom)

- Remember (recordar hechos)
- Understand (comprender conceptos)
- Apply (aplicar conocimientos)
- Analyze (analizar información)
- Evaluate (evaluar críticamente)
- Create (crear soluciones nuevas)

### Niveles DOK (Depth of Knowledge)

- 1: Recall (recordar hechos)
- 2: Skills/Concepts (aplicar habilidades)
- 3: Strategic Thinking (pensamiento estratégico)
- 4: Extended Thinking (pensamiento extendido)

### Tipos de Pregunta

1. **Multiple choice**: 4 opciones con explicaciones
2. **Open text**: Respuesta escrita con criterios de evaluación
3. **Open text (numerical)**: Respuesta numérica con margen de error

## 📄 Estructura del Proyecto

```
functions/
├── src/
│   └── index.ts          # Código principal (Cloud Functions)
├── lib/                  # JavaScript compilado (generado)
├── node_modules/         # Dependencias
├── package.json          # Configuración npm
├── package-lock.json     # Lock de dependencias
├── tsconfig.json         # Configuración TypeScript
├── .eslintrc.js          # Configuración ESLint
├── .env                  # Variables de entorno (NO commitear)
├── .env.example          # Template de variables
└── README.md             # Esta documentación
```

## 🤝 Contribución

Este proyecto es parte del sistema educativo Cuwi.

## 📝 Licencia

Propiedad de Cuwi Project.

---

**¿Necesitas ayuda?** Revisa la sección de Troubleshooting o consulta los logs con `firebase functions:log`.
