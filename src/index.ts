/* eslint-disable camelcase */
import {onRequest} from "firebase-functions/v2/https";
import {GoogleGenerativeAI} from "@google/generative-ai";
import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const DOCLING_API_URL =
  process.env.DOCLING_API_URL || "https://api.docling.io/v1";
const DOCLING_API_KEY = process.env.DOCLING_API_KEY || "";

/**
 * Cleans JSON from Gemini response by removing markdown code blocks
 * @param {string} text - Raw text from Gemini
 * @return {string} Cleaned JSON string
 */
function cleanJSON(text: string): string {
  return text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

/**
 * Validates the structure of the generated questions response
 * @param {unknown} data - Data to validate
 * @return {object} Validation result with valid flag and optional error
 */
function validateResponse(data: unknown): {valid: boolean; error?: string} {
  if (!data || typeof data !== "object") {
    return {valid: false, error: "Respuesta no es un objeto"};
  }

  const response = data as Record<string, unknown>;

  if (!Array.isArray(response.questions)) {
    return {valid: false, error: "'questions' no es un array"};
  }

  if (response.questions.length === 0) {
    return {valid: false, error: "'questions' está vacío"};
  }

  for (let i = 0; i < response.questions.length; i++) {
    const q = response.questions[i] as Record<string, unknown>;

    if (!q.question || typeof q.question !== "string") {
      return {valid: false, error: `Pregunta ${i + 1}: falta 'question'`};
    }
    if (!Array.isArray(q.options) || q.options.length === 0) {
      return {
        valid: false,
        error: `Pregunta ${i + 1}: falta 'options'`,
      };
    }
    if (typeof q.answer !== "number") {
      return {valid: false, error: `Pregunta ${i + 1}: falta 'answer'`};
    }
    if (!q.configuration || typeof q.configuration !== "object") {
      return {
        valid: false,
        error: `Pregunta ${i + 1}: falta 'configuration'`,
      };
    }
  }

  return {valid: true};
}

// Interfaz para chunks (según documento)
interface Chunk {
  id: string;
  type: "title" | "paragraph" | "table" | "list";
  text: string;
  page?: number;
}

// Interfaz para respuesta de Docling API
interface DoclingChunk {
  id?: string;
  type?: string;
  content: string;
  metadata?: {
    page?: number;
    section?: string;
    heading?: string;
  };
}

interface DoclingResponse {
  status: "success" | "error";
  chunks?: DoclingChunk[];
  pages?: number;
  document_type?: string;
  error?: string;
}

// Interfaz para los parámetros de generación
interface QuestionGenerationParams {
  educational_level: string;
  subject?: string;
  context: string;
  number_of_questions: number;
  bloom: string;
  dok: number;
  question_type: string[];
}

// Interfaz para las preguntas generadas
interface GeneratedQuestion {
  question: string;
  options: Array<{
    id: number;
    description: string;
    explanation?: string;
  }>;
  answer: number;
  configuration: {
    open: boolean;
    numerical: boolean;
    error_range?: number;
    case_sensitive: boolean;
  };
}

interface GeneratedQuestionsResponse {
  questions: GeneratedQuestion[];
}

/**
 * Generates educational questions using Gemini AI
 * @param {GoogleGenerativeAI} model - Gemini model instance
 * @param {string} content - Content to generate questions from
 * @param {QuestionGenerationParams} params - Generation parameters
 * @return {Promise<GeneratedQuestionsResponse>} Generated questions
 */
async function generateQuestionsForContent(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  content: string,
  params: QuestionGenerationParams
): Promise<GeneratedQuestionsResponse> {
  const {
    educational_level,
    context,
    number_of_questions,
    bloom,
    dok,
    question_type,
  } = params;

  const prompt = `
Eres un generador de preguntas educativas. Tu respuesta debe ser
ÚNICAMENTE un JSON válido, sin texto adicional.

PARÁMETROS:
- Nivel educativo: ${educational_level}
- Contexto/enfoque: ${context}
- Contenido: ${content}
- Cantidad de preguntas: ${number_of_questions}
- Nivel Bloom: ${bloom}
- Nivel DOK: ${dok}
- Tipo(s) de pregunta: ${question_type.join(", ")}

INSTRUCCIONES:
1. Genera exactamente ${number_of_questions} pregunta(s).
2. Adapta el vocabulario al nivel ${educational_level}.
3. Alinea la dificultad con Bloom (${bloom}) y DOK (${dok}).
4. No repitas preguntas ni opciones.
5. Distribuye equitativamente entre Multiple choice y Open text si
   es que tiene ambas, si no solo haz una.

FORMATO DE RESPUESTA OBLIGATORIO:
{
  "questions": [
    {
      "question": "string - la pregunta",
      "options": [
        {
          "id": 1,
          "description": "string - texto de la opción",
          "explanation?": "string - por qué es correcta o incorrecta"
          (Igual es opcional)
        }
      ],
      "answer": number (el numero del id de la respuesta correcta),
      "configuration": {
        "open": false,
        "numerical": false,
        error_range?: number; (Esta es opcional y es solo si es una
        pregunta numerica que contenga margen de error, por ejemplo
        una pregunta matematica)
        "case_sensitive": false
      }
    }
  ]
}

REGLAS POR TIPO DE PREGUNTA:


MULTIPLE CHOICE:
- "options": exactamente 4 opciones con id: 1, 2, 3, 4
- "answer": id de la opción correcta (1, 2, 3 o 4)
- "configuration":
  {"open": false, "numerical": false, "case_sensitive": false}
- Cada opción necesita "explanation"

OPEN TEXT (respuesta escrita):
- "options": 1 sola opción con id: 1 (la respuesta esperada)
- "answer": 1
- "configuration":
  {"open": true, "numerical": false, "case_sensitive": false}
- "explanation": criterios de evaluación

OPEN TEXT NUMÉRICA (si la respuesta es un número):
- "options": 1 sola opción con id: 1 (el valor numérico como string)
- "answer": 1
- "configuration":
  {"open": true, "numerical": true, "error_range": 0.5,
   "case_sensitive": false}
- "error_range": margen de error aceptable


EJEMPLO MULTIPLE CHOICE:
{
  "question": "¿Cuál es el planeta más grande del sistema solar?",
  "options": [
    {"id": 1, "description": "Júpiter",
     "explanation": "Correcto. Júpiter es el planeta más grande
     con un diámetro de 139,820 km."},
    {"id": 2, "description": "Saturno",
     "explanation": "Incorrecto. Saturno es el segundo más grande."},
    {"id": 3, "description": "Neptuno",
     "explanation": "Incorrecto. Neptuno es mucho más pequeño
     que Júpiter."},
    {"id": 4, "description": "Tierra",
     "explanation": "Incorrecto. La Tierra es un planeta pequeño
     comparado con los gigantes gaseosos."}
  ],
  "answer": 1,
  "configuration":
    {"open": false, "numerical": false, "case_sensitive": false}
}

EJEMPLO OPEN TEXT:
{
  "question": "Explica el proceso de fotosíntesis en tus propias
  palabras.",
  "options": [
    {"id": 1, "description": "La fotosíntesis es el proceso por
    el cual las plantas convierten la luz solar, agua y dióxido de
    carbono en glucosa y oxígeno.", "explanation": "Debe mencionar:
    luz solar, agua, CO2, glucosa y oxígeno."}
  ],
  "answer": 1,
  "configuration":
    {"open": true, "numerical": false, "case_sensitive": false}
}

EJEMPLO OPEN TEXT NUMÉRICA:
{
  "question": "Si un árbol produce 100 kg de oxígeno al año,
  ¿cuánto producirán 5 árboles?",
  "options": [
    {"id": 1, "description": "500",
     "explanation": "Multiplicación simple: 100 x 5 = 500 kg"}
  ],
  "answer": 1,
  "configuration":
    {"open": true, "numerical": true, "error_range": 0,
     "case_sensitive": false}
}

RESPONDE SOLO CON EL JSON, SIN TEXTO ANTES NI DESPUÉS:
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleanedText = cleanJSON(text);
  const parsed = JSON.parse(cleanedText);

  const validation = validateResponse(parsed);
  if (!validation.valid) {
    throw new Error(`Validation error: ${validation.error}`);
  }

  return parsed;
}

/**
 * Validates the structure of a chunk
 * @param {unknown} chunk - Chunk to validate
 * @param {number} index - Index of the chunk
 * @return {object} Validation result
 */
function validateChunk(
  chunk: unknown,
  index: number
): {valid: boolean; error?: string} {
  if (!chunk || typeof chunk !== "object") {
    return {
      valid: false,
      error: `Chunk ${index}: no es un objeto válido`,
    };
  }

  const c = chunk as Record<string, unknown>;

  if (!c.id) {
    return {valid: false, error: `Chunk ${index}: falta 'id'`};
  }
  const validTypes = ["title", "paragraph", "table", "list"];
  if (!c.type || !validTypes.includes(c.type as string)) {
    return {
      valid: false,
      error: `Chunk ${index}: 'type' inválido (debe ser title,
      paragraph, table, o list)`,
    };
  }
  if (
    !c.text ||
    typeof c.text !== "string" ||
    (c.text as string).trim() === ""
  ) {
    return {
      valid: false,
      error: `Chunk ${index}: falta 'text' o está vacío`,
    };
  }

  return {valid: true};
}

/**
 * Calls Docling API to convert document to chunks
 * @param {string} documentUrl - Optional URL of document to process
 * @param {string} documentBase64 - Optional base64 encoded document
 * @return {Promise<Chunk[]>} Array of processed chunks
 */
async function callDoclingAPI(
  documentUrl?: string,
  documentBase64?: string
): Promise<Chunk[]> {
  try {
    // Validar inputs
    if (!documentUrl && !documentBase64) {
      throw new Error("Se requiere document_url o document_file");
    }

    if (!DOCLING_API_KEY) {
      throw new Error("DOCLING_API_KEY no está configurada");
    }

    // Preparar request body
    const requestBody: Record<string, string> = {};
    if (documentUrl) {
      requestBody.url = documentUrl;
    } else if (documentBase64) {
      requestBody.file = documentBase64;
    }

    // Llamar a Docling API
    const response = await axios.post<DoclingResponse>(
      `${DOCLING_API_URL}/convert`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DOCLING_API_KEY}`,
        },
        timeout: 60000, // 60 segundos
      }
    );

    // Validar respuesta
    if (!response.data || response.data.status !== "success") {
      throw new Error(
        `Docling API error: ${response.data?.error || "Unknown error"}`
      );
    }

    if (!response.data.chunks || response.data.chunks.length === 0) {
      throw new Error("Docling no devolvio chunks del documento");
    }

    // Transformar chunks de Docling a nuestro formato
    const transformedChunks: Chunk[] = response.data.chunks.map(
      (dc, index) => ({
        id: dc.id || `chunk_${index + 1}`,
        type: mapDoclingType(dc.type),
        text: dc.content.trim(),
        page: dc.metadata?.page,
      })
    );

    return transformedChunks;
  } catch (error) {
    // Manejo específico de errores de axios
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        throw new Error("Timeout al conectar con Docling API");
      }
      if (error.response) {
        throw new Error(
          `Docling API error (${error.response.status}): ${
            error.response.data?.message || error.message
          }`
        );
      }
      if (error.request) {
        throw new Error("No se pudo conectar con Docling API");
      }
    }
    throw error;
  }
}

/**
 * Maps Docling type to our chunk type
 * @param {string} doclingType - Docling type string
 * @return {string} Mapped chunk type
 */
function mapDoclingType(
  doclingType?: string
): "title" | "paragraph" | "table" | "list" {
  if (!doclingType) return "paragraph";


  const type = doclingType.toLowerCase();
  if (type.includes("heading") || type.includes("title")) return "title";
  if (type.includes("table")) return "table";
  if (type.includes("list") || type.includes("bullet")) return "list";
  return "paragraph";
}

export const helloWorld = onRequest((request, response) => {
  response.json({
    message: "¡Hola desde Firebase Functions!",
    timestamp: new Date().toISOString(),
    status: "ok",
  });
});

export const generateQuestions = onRequest(async (request, response) => {
  try {
    const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

    const {
      educational_level = "High School",
      subject = "Ciencias",
      content =
      "El sistema solar está formado por el Sol y los cuerpos celestes.",
      context = "Enfoque práctico",
      number_of_questions = 3,
      bloom = "Understand",
      dok = 2,
      question_type = ["Multiple choice"],
    } = request.body || {};

    if (!content || typeof content !== "string" || content.trim() === "") {
      response.status(400).json({
        success: false,
        error:
          "El campo 'content' es requerido y debe ser un string no vacío",
      });
      return;
    }

    if (content.length > 50000) {
      response.status(400).json({
        success: false,
        error: "El contenido excede el límite de 50,000 caracteres",
      });
      return;
    }

    const questionTypes = Array.isArray(question_type) ?
      question_type :
      [question_type];

    const parsed = await generateQuestionsForContent(model, content, {
      educational_level,
      subject,
      context,
      number_of_questions,
      bloom,
      dok,
      question_type: questionTypes,
    });

    response.json({
      success: true,
      metadata: {
        educational_level,
        subject,
        bloom,
        dok,
        question_types: questionTypes,
        total_questions: parsed.questions.length,
      },
      data: parsed,
    });
  } catch (error) {
    console.error("Error:", error);

    let statusCode = 500;
    let errorMessage = "Error al generar preguntas";
    const details = error instanceof Error ? error.message : "Unknown error";

    // Manejo específico de tipos de error
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        statusCode = 401;
        errorMessage = "Error de autenticación con Gemini API";
      } else if (
        error.message.includes("quota") ||
        error.message.includes("rate limit")
      ) {
        statusCode = 429;
        errorMessage = "Límite de tasa de Gemini API excedido";
      } else if (error.message.includes("Validation error")) {
        statusCode = 422;
        errorMessage = "La respuesta de Gemini no es válida";
      }
    }

    response.status(statusCode).json({
      success: false,
      error: errorMessage,
      details,
    });
  }
});

export const generateQuestionsFromChunks = onRequest(
  async (request, response) => {
    try {
      const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

      const {
        educational_level = "High School",
        subject = "Ciencias",
        context = "Enfoque práctico",
        number_of_questions = 10,
        bloom = "Understand",
        dok = 2,
        question_type = ["Multiple choice"],
        chunks = [],
      } = request.body || {};

      // Validar chunks
      if (!Array.isArray(chunks) || chunks.length === 0) {
        response.status(400).json({
          success: false,
          error:
            "El campo 'chunks' es requerido y debe ser un array no vacío",
        });
        return;
      }

      // Validar cada chunk
      for (let i = 0; i < chunks.length; i++) {
        const validation = validateChunk(chunks[i], i);
        if (!validation.valid) {
          response.status(400).json({
            success: false,
            error: validation.error,
          });
          return;
        }
      }

      const questionTypes = Array.isArray(question_type) ?
        question_type :
        [question_type];

      // Distribución de preguntas
      const questionsPerChunk =
        Math.floor(number_of_questions / chunks.length);
      const remainder = number_of_questions % chunks.length;

      const allQuestions: GeneratedQuestion[] = [];
      const chunkResults: {
        chunk_id: string;
        questions_generated: number;
        status: string;
      }[] = [];

      // Procesar chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i] as Chunk;
        const questionsForThisChunk =
          questionsPerChunk + (i < remainder ? 1 : 0);

        if (questionsForThisChunk === 0) {
          chunkResults.push({
            chunk_id: chunk.id,
            questions_generated: 0,
            status: "skipped",
          });
          continue;
        }

        try {
          const result = await generateQuestionsForContent(
            model,
            chunk.text,
            {
              educational_level,
              subject,
              context,
              number_of_questions: questionsForThisChunk,
              bloom,
              dok,
              question_type: questionTypes,
            }
          );

          const questionsWithMetadata = result.questions.map(
            (q: GeneratedQuestion) => ({
              ...q,
              source: {
                chunk_id: chunk.id,
                chunk_type: chunk.type,
                page: chunk.page,
              },
            })
          );

          allQuestions.push(...questionsWithMetadata);
          chunkResults.push({
            chunk_id: chunk.id,
            questions_generated: result.questions.length,
            status: "success",
          });
        } catch (error) {
          console.error(`Error en chunk ${chunk.id}:`, error);
          chunkResults.push({
            chunk_id: chunk.id,
            questions_generated: 0,
            status: "error",
          });
          // Continúa con el siguiente chunk en lugar de fallar todo
        }
      }

      // Verificar si se generaron preguntas
      if (allQuestions.length === 0) {
        response.status(500).json({
          success: false,
          error: "No se pudieron generar preguntas de ningún chunk",
          chunk_results: chunkResults,
        });
        return;
      }

      response.json({
        success: true,
        metadata: {
          source: "chunks_processing",
          educational_level,
          subject,
          bloom,
          dok,
          question_types: questionTypes,
          total_questions: allQuestions.length,
          total_chunks: chunks.length,
          chunk_results: chunkResults,
        },
        data: {
          questions: allQuestions,
        },
      });
    } catch (error) {
      console.error("Error:", error);
      response.status(500).json({
        success: false,
        error: "Error al procesar chunks",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export const generateQuestionsFromDocument = onRequest(
  async (request, response) => {
    try {
      const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

      const {
        document_url,
        document_file,
        educational_level = "High School",
        subject = "General",
        context = "Enfoque práctico",
        number_of_questions = 10,
        bloom = "Understand",
        dok = 2,
        question_type = ["Multiple choice"],
      } = request.body || {};

      // Validar input
      if (!document_url && !document_file) {
        response.status(400).json({
          success: false,
          error: "Se requiere 'document_url' o 'document_file'",
        });
        return;
      }

      // Llamar a Docling API
      let chunks: Chunk[];
      try {
        chunks = await callDoclingAPI(document_url, document_file);
      } catch (doclingError) {
        response.status(503).json({
          success: false,
          error: "Error al procesar el documento con Docling",
          details:
            doclingError instanceof Error ?
              doclingError.message :
              "Unknown error",
        });
        return;
      }

      // Validar que se obtuvieron chunks
      if (chunks.length === 0) {
        response.status(422).json({
          success: false,
          error: "El documento no contiene texto procesable",
        });
        return;
      }

      const questionTypes = Array.isArray(question_type) ?
        question_type :
        [question_type];

      // Distribuir preguntas entre chunks
      // (misma lógica que generateQuestionsFromChunks)
      const questionsPerChunk =
        Math.floor(number_of_questions / chunks.length);
      const remainder = number_of_questions % chunks.length;

      const allQuestions: GeneratedQuestion[] = [];
      const chunkResults: {
        chunk_id: string;
        questions_generated: number;
        status: string;
      }[] = [];

      // Procesar cada chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const questionsForThisChunk =
          questionsPerChunk + (i < remainder ? 1 : 0);

        if (questionsForThisChunk === 0) {
          chunkResults.push({
            chunk_id: chunk.id,
            questions_generated: 0,
            status: "skipped",
          });
          continue;
        }

        try {
          const result = await generateQuestionsForContent(
            model,
            chunk.text,
            {
              educational_level,
              subject,
              context,
              number_of_questions: questionsForThisChunk,
              bloom,
              dok,
              question_type: questionTypes,
            }
          );

          const questionsWithMetadata = result.questions.map(
            (q: GeneratedQuestion) => ({
              ...q,
              source: {
                chunk_id: chunk.id,
                chunk_type: chunk.type,
                page: chunk.page,
              },
            })
          );

          allQuestions.push(...questionsWithMetadata);
          chunkResults.push({
            chunk_id: chunk.id,
            questions_generated: result.questions.length,
            status: "success",
          });
        } catch (error) {
          console.error(`Error en chunk ${chunk.id}:`, error);
          chunkResults.push({
            chunk_id: chunk.id,
            questions_generated: 0,
            status: "error",
          });
          // Continuar con siguiente chunk (aislamiento de errores)
        }
      }

      // Verificar que se generaron preguntas
      if (allQuestions.length === 0) {
        response.status(500).json({
          success: false,
          error: "No se pudieron generar preguntas del documento",
          chunk_results: chunkResults,
        });
        return;
      }

      response.json({
        success: true,
        metadata: {
          source: "docling_processing",
          document_url: document_url || "base64_file",
          educational_level,
          subject,
          bloom,
          dok,
          question_types: questionTypes,
          total_questions: allQuestions.length,
          total_chunks: chunks.length,
          chunk_results: chunkResults,
        },
        data: {
          questions: allQuestions,
        },
      });
    } catch (error) {
      console.error("Error:", error);
      response.status(500).json({
        success: false,
        error: "Error al procesar el documento",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Generates mock chunks simulating Docling API response
 * @return {Chunk[]} Mock chunks for testing
 */
function getMockDoclingChunks(): Chunk[] {
  return [
    {
      id: "mock_chunk_1",
      type: "title",
      text: "El Sistema Solar",
      page: 1,
    },
    {
      id: "mock_chunk_2",
      type: "paragraph",
      text: `El sistema solar es el sistema planetario que incluye al Sol y
      todos los objetos que orbitan a su alrededor. Está compuesto por ocho
      planetas: Mercurio, Venus, Tierra, Marte, Júpiter, Saturno, Urano y
      Neptuno. Los cuatro planetas interiores son rocosos y pequeños, mientras
      que los cuatro exteriores son gigantes gaseosos.`,
      page: 1,
    },
    {
      id: "mock_chunk_3",
      type: "title",
      text: "Los Planetas Interiores",
      page: 2,
    },
    {
      id: "mock_chunk_4",
      type: "paragraph",
      text: `Los planetas interiores, también conocidos como planetas
      terrestres, son Mercurio, Venus, Tierra y Marte. Estos planetas tienen
      superficies sólidas compuestas principalmente de rocas y metales. La
      Tierra es el único planeta conocido que alberga vida, gracias a su
      atmósfera rica en oxígeno y la presencia de agua líquida.`,
      page: 2,
    },
    {
      id: "mock_chunk_5",
      type: "list",
      text: `Características de los planetas terrestres:
      - Tamaño relativamente pequeño
      - Superficies sólidas y rocosas
      - Pocas o ninguna luna
      - Sin sistemas de anillos
      - Atmósferas delgadas o inexistentes (excepto Venus y Tierra)`,
      page: 3,
    },
    {
      id: "mock_chunk_6",
      type: "title",
      text: "Los Planetas Exteriores",
      page: 4,
    },
    {
      id: "mock_chunk_7",
      type: "paragraph",
      text: `Los planetas exteriores son Júpiter, Saturno, Urano y Neptuno.
      Estos gigantes gaseosos son mucho más grandes que los planetas
      terrestres y están compuestos principalmente de hidrógeno y helio.
      Júpiter es el más grande de todos los planetas, con un diámetro de
      aproximadamente 139,820 kilómetros.`,
      page: 4,
    },
    {
      id: "mock_chunk_8",
      type: "table",
      text: `Comparación de planetas:
      | Planeta | Tipo | Diámetro (km) | Lunas |
      |---------|------|---------------|-------|
      | Tierra  | Terrestre | 12,742 | 1 |
      | Júpiter | Gaseoso | 139,820 | 79 |
      | Saturno | Gaseoso | 116,460 | 82 |`,
      page: 5,
    },
  ];
}

/**
 * MOCK ENDPOINT: Simulates document processing without calling Docling API
 * Use this for testing and development without consuming external API quota
 */
export const generateQuestionsFromDocumentMock = onRequest(
  async (request, response) => {
    try {
      const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

      const {
        educational_level = "High School",
        subject = "Ciencias - Astronomía",
        context = "Enfoque educativo general",
        number_of_questions = 10,
        bloom = "Understand",
        dok = 2,
        question_type = ["Multiple choice"],
      } = request.body || {};

      // Obtener chunks simulados (sin llamar a Docling API)
      const chunks = getMockDoclingChunks();

      console.log(`[MOCK] Procesando ${chunks.length} chunks simulados`);

      const questionTypes = Array.isArray(question_type) ?
        question_type :
        [question_type];

      // Distribuir preguntas entre chunks
      const questionsPerChunk =
        Math.floor(number_of_questions / chunks.length);
      const remainder = number_of_questions % chunks.length;

      const allQuestions: GeneratedQuestion[] = [];
      const chunkResults: {
        chunk_id: string;
        questions_generated: number;
        status: string;
      }[] = [];

      // Procesar cada chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const questionsForThisChunk =
          questionsPerChunk + (i < remainder ? 1 : 0);

        if (questionsForThisChunk === 0) {
          chunkResults.push({
            chunk_id: chunk.id,
            questions_generated: 0,
            status: "skipped",
          });
          continue;
        }

        try {
          const result = await generateQuestionsForContent(
            model,
            chunk.text,
            {
              educational_level,
              subject,
              context,
              number_of_questions: questionsForThisChunk,
              bloom,
              dok,
              question_type: questionTypes,
            }
          );

          const questionsWithMetadata = result.questions.map(
            (q: GeneratedQuestion) => ({
              ...q,
              source: {
                chunk_id: chunk.id,
                chunk_type: chunk.type,
                page: chunk.page,
              },
            })
          );

          allQuestions.push(...questionsWithMetadata);
          chunkResults.push({
            chunk_id: chunk.id,
            questions_generated: result.questions.length,
            status: "success",
          });
        } catch (error) {
          console.error(`[MOCK] Error en chunk ${chunk.id}:`, error);
          chunkResults.push({
            chunk_id: chunk.id,
            questions_generated: 0,
            status: "error",
          });
          // Continuar con siguiente chunk
        }
      }

      // Verificar que se generaron preguntas
      if (allQuestions.length === 0) {
        response.status(500).json({
          success: false,
          error: "No se pudieron generar preguntas de los chunks mock",
          chunk_results: chunkResults,
        });
        return;
      }

      response.json({
        success: true,
        metadata: {
          source: "mock_docling",
          document_type: "simulated_pdf",
          educational_level,
          subject,
          bloom,
          dok,
          question_types: questionTypes,
          total_questions: allQuestions.length,
          total_chunks: chunks.length,
          chunk_results: chunkResults,
        },
        data: {
          questions: allQuestions,
        },
      });
    } catch (error) {
      console.error("[MOCK] Error:", error);
      response.status(500).json({
        success: false,
        error: "Error al procesar documento mock",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

