const { GoogleGenerativeAI } = require("@google/generative-ai");

// Poné tu clave de Gemini acá para las pruebas locales
const GEMINI_API_KEY = process.env.GEMINI_API_KEY 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);


// 1. Extrae los datos básicos del mensaje de WhatsApp
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
        4. Si un dato no está en el texto, devolvé null.
        5. "listo_para_cotizar": true solo si tenemos obligatoriamente: marca, modelo, año y codigo_postal.
        
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
        const datos = JSON.parse(res.response.text());
        console.log(`✅ [IA] Vehículo: ${datos.marca} ${datos.modelo} ${datos.anio} | Uso: ${datos.uso} | GNC: ${datos.gnc}`);
        return datos;
    } catch (error) {
        console.error("❌ [IA] Error en extracción:", error.message);
        return null;
    }
}
// 2. Actúa de árbitro cruzando lo que pide el cliente con el catálogo de Woker
async function arbitroDeVersiones(versionBuscada, opcionesWoker) {
    console.log(`🧠 [IA] Buscando coincidencia exacta para "${versionBuscada}"...`);
    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" } 
        });

        const prompt = `
        Sos un sistema informático estricto. Compara la versión que busca el cliente con la lista oficial de Woker.
        Debes devolver ÚNICAMENTE un JSON válido. Las claves deben tener comillas dobles. No agregues texto extra.
        
        REGLA 1: Si hay UNA coincidencia obvia y segura, devuelve:
        {"seguro": true, "id_elegido": "TOKEN_ACA", "descripcion": "NOMBRE_ACA", "opciones": []}
        
        REGLA 2: Si hay dudas, es ambiguo (ej: dice "base" y hay 5 versiones) o el modelo tiene múltiples variantes similares, devuelve un top 3 o 4 de las mejores opciones así:
        {"seguro": false, "id_elegido": null, "descripcion": null, "opciones": [{"id": "...", "descripcion": "..."}, {"id": "...", "descripcion": "..."}]}

        Cliente busca: "${versionBuscada}"
        Lista oficial: ${JSON.stringify(opcionesWoker)}
        `;

        const res = await model.generateContent(prompt);
        // Limpiamos la respuesta por si Gemini metió espacios en blanco o saltos de línea al principio/final
        const textoLimpio = res.response.text().trim(); 
        
        return JSON.parse(textoLimpio);
    } catch (error) {
        console.error("❌ [IA] Error en el árbitro al leer el JSON de Gemini:", error.message);
        return null;
    }
}

module.exports = { extraerDatosVehiculo, arbitroDeVersiones };