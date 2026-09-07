const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function extraerDatosVehiculo(textoCliente) {
    console.log(`\n🧠 [IA] Analizando mensaje del cliente con datos completos...`);
    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" } 
        });

        const prompt = `
        Sos un experto en seguros de autos. Extraé los datos del vehículo y conductor en JSON.
        Reglas:
        1. Normalizá la marca al nombre OFICIAL COMPLETO (ej: "VW" -> "Volkswagen").
        2. "gnc": true solo si dice GNC o Gas explícitamente.
        3. "uso": 1 para Particular, 2 para Comercial (fletes, reparto), 3 para Plataformas (Uber, Cabify, Didi). Si no menciona nada, asume 1.
        4. Si extraes una fecha de nacimiento, formatea OBLIGATORIAMENTE como "YYYY-MM-DD".
        5. Si un dato no está en el texto, devolvé null.
        6. "listo_para_cotizar": true solo si tenemos obligatoriamente: marca, modelo, año y codigo_postal.
        
        Estructura requerida:
        {
          "marca": "string",
          "modelo": "string",
          "version_buscada": "string",
          "anio": "number",
          "gnc": "boolean",
          "uso": "number",
          "dni": "string",
          "fecha_nacimiento": "string",
          "provincia": "string",
          "localidad": "string",
          "codigo_postal": "string",
          "listo_para_cotizar": "boolean"
        }

        Texto: "${textoCliente}"
        `;

        const res = await model.generateContent(prompt);
        const textoLimpio = res.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const datos = JSON.parse(textoLimpio);
        console.log(`✅ [IA] Vehículo: ${datos.marca} ${datos.modelo} ${datos.anio} | Uso: ${datos.uso} | GNC: ${datos.gnc}`);
        return datos;
    } catch (error) {
        console.error("❌ [IA] Error en extracción:", error.message);
        return null;
    }
}

// 🟢 FIX: Pasamos datosAuto completo y aplicamos la regla estricta de modelo
async function arbitroDeVersiones(datosAuto, opcionesWoker) {
    console.log(`🧠 [IA] Evaluando versiones exactas para "${datosAuto.modelo} ${datosAuto.version_buscada}"...`);
    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" } 
        });

        const prompt = `
        Sos un sistema informático estricto. Compara el auto que busca el cliente con la lista oficial.
        Debes devolver ÚNICAMENTE un JSON válido. Las claves deben tener comillas dobles. No agregues texto extra.
        
        REGLA 1: Si hay UNA coincidencia obvia y segura, devuelve:
        {"seguro": true, "id_elegido": "TOKEN_ACA", "descripcion": "NOMBRE_ACA", "opciones": []}
        
        REGLA 2: Si hay dudas o múltiples variantes, devuelve TODAS las opciones válidas (hasta un máximo de 15).
        🚨 REGLA ESTRICTA DE MODELO: El cliente busca EXPRESAMENTE el modelo "${datosAuto.modelo}". Debes DESCARTAR INMEDIATAMENTE cualquier opción de la lista que pertenezca a un modelo distinto con nombre similar (Ejemplo: Si busca "Gol", elimina todo lo que sea "Golf").

        Cliente busca: Marca "${datosAuto.marca}", Modelo "${datosAuto.modelo}", Versión "${datosAuto.version_buscada}"
        Lista oficial de Woker: ${JSON.stringify(opcionesWoker)}
        `;

        const res = await model.generateContent(prompt);
        const textoLimpio = res.response.text().replace(/```json/g, '').replace(/```/g, '').trim(); 
        return JSON.parse(textoLimpio);
    } catch (error) {
        console.error("❌ [IA] Error en el árbitro al leer el JSON de Gemini:", error.message);
        return null;
    }
}

async function corregirLocalidadIA(localidadEscrita, opcionesWoker) {
    try {
        const prompt = `
        El usuario escribió la localidad: "${localidadEscrita}".
        Las opciones válidas en la base de datos son: ${JSON.stringify(opcionesWoker)}.
        
        Tu tarea: Encuentra la opción válida que mejor coincida con lo que escribió el usuario (corrigiendo errores de tipeo o abreviaciones). 
        Si hay una coincidencia clara, responde ÚNICAMENTE con el nombre exacto de la opción válida.
        Si lo que escribió el usuario no tiene nada que ver con ninguna opción, responde exactamente la palabra: null.
        No des explicaciones, solo el nombre o null.
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
        const result = await model.generateContent(prompt);
        const respuesta = result.response.text().trim();
        
        return respuesta === "null" ? null : respuesta;
    } catch (error) {
        console.error("❌ Error en IA corrigiendo localidad:", error);
        return null;
    }
}

async function corregirMarcaIA(marcaEscrita, opcionesWoker) {
    try {
        const prompt = `
        El usuario escribió la marca de auto: "${marcaEscrita}".
        Las opciones válidas en la base de datos son: ${JSON.stringify(opcionesWoker)}.
        
        Tu tarea: Encuentra la opción válida que mejor coincida con lo que escribió el usuario (corrigiendo errores de tipeo, o abreviaciones como "VW" para Volkswagen, "MB" para Mercedes Benz o "Chevy" para Chevrolet). 
        Si hay una coincidencia clara, responde ÚNICAMENTE con el nombre exacto de la opción válida.
        Si lo que escribió el usuario no tiene nada que ver con ninguna marca de auto, responde exactamente la palabra: null.
        No des explicaciones, solo el nombre exacto o null.
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
        const result = await model.generateContent(prompt);
        const respuesta = result.response.text().trim();
        
        return respuesta === "null" ? null : respuesta;
    } catch (error) {
        console.error("❌ Error en IA corrigiendo marca:", error);
        return null;
    }
}

async function corregirModeloIA(modeloEscrito, opcionesModelos) {
    try {
        const prompt = `
        El usuario buscó el modelo de auto: "${modeloEscrito}" (puede tener errores como "capture" o "cruzze").
        Aquí hay una muestra de las versiones completas disponibles en la base de datos para esta marca:
        ${JSON.stringify(opcionesModelos)}
        
        Tu tarea: Identifica cuál es el nombre correcto del modelo que el usuario intentó escribir.
        Debes responder ÚNICAMENTE con la palabra exacta que representa el modelo (ej: "Captur", "Cruze", "Gol").
        No devuelvas toda la versión completa, solo la palabra clave del modelo.
        Si lo que escribió el usuario no tiene ninguna relación con los autos de la lista, responde exactamente: null.
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
        const result = await model.generateContent(prompt);
        const respuesta = result.response.text().trim();
        
        return respuesta === "null" ? null : respuesta;
    } catch (error) {
        console.error("❌ Error en IA corrigiendo modelo:", error);
        return null;
    }
}

module.exports = { extraerDatosVehiculo, arbitroDeVersiones, corregirLocalidadIA, corregirMarcaIA, corregirModeloIA };