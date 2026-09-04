// Usamos process.env para cuando subamos a Render, o tu clave fija para probar ahora
const WOKER_API_KEY = process.env.WOKER_API_KEY || "wkr_zScowU4k8Q1NCHZnoDjMXrNNjKwh8C-9DKaVmOKaPPI";
const BASE_URL = "https://grupoab.woker.ar/api/v1";

const headers = { 
    'Authorization': `Bearer ${WOKER_API_KEY}`, 
    'Content-Type': 'application/json' 
};

// 1. Busca la marca y pre-filtra las versiones por modelo
async function obtenerVersionesWoker(marcaTexto, modeloTexto, anio) {
    console.log(`\n🔍 [WOKER] Buscando catálogo para: ${marcaTexto} ${modeloTexto} ${anio}...`);
    try {
        // Buscar ID de Marca
        const resMarcas = await fetch(`${BASE_URL}/catalogos/marcas?rama=1`, { headers });
        const jsonMarcas = await resMarcas.json();
        const marcaObj = jsonMarcas.data?.find(m => m.label.toLowerCase() === marcaTexto.toLowerCase());

        if (!marcaObj) {
            console.log("❌ [WOKER] No se encontró la marca en el catálogo.");
            return [];
        }

        // Buscar versiones de esa marca y año
        const resVers = await fetch(`${BASE_URL}/catalogos/versiones?rama=1&marca=${marcaObj.id}&anio=${anio}`, { headers });
        const jsonVers = await resVers.json();

        // Limpiar la basura: dejar solo las que contengan la palabra del modelo
        const versionesFiltradas = (jsonVers.data || [])
            .filter(v => v.label.toLowerCase().includes(modeloTexto.toLowerCase()))
            .map(v => ({ id: v.id, descripcion: v.label }));

        console.log(`✅ [WOKER] Se encontraron ${versionesFiltradas.length} versiones pre-filtradas.`);
        return versionesFiltradas;
    } catch (error) {
        console.error("❌ [WOKER] Error buscando versiones:", error.message);
        return [];
    }
}

// Ahora recibe "tokenVersion" y el objeto completo "datosAuto" que armó la IA
async function cotizarEnWoker(tokenVersion, datosAuto) {
    console.log(`\n🚀 [WOKER] Disparando cotización oficial...`);
    try {
        const resForma = await fetch(`${BASE_URL}/catalogos/forma-pago`, { headers });
        const catForma = await resForma.json();
        const tarjetaCredito = catForma.data?.find(f => f.label.toLowerCase().includes('tarjeta'));
        const idFormaPago = tarjetaCredito ? tarjetaCredito.id : 2;

        // 🟢 Inteligencia para buscar el Uso correcto dinámicamente
        const resUsos = await fetch(`${BASE_URL}/catalogos/usos`, { headers });
        const catUsos = await resUsos.json();
        let idUsoOficial = 1; // Particular por defecto
        
        if (datosAuto.uso === 3) { // Plataformas
            const usoUber = catUsos.data?.find(u => u.label.toLowerCase().includes('uber') || u.label.toLowerCase().includes('plataforma'));
            if (usoUber) idUsoOficial = usoUber.id;
        } else if (datosAuto.uso === 2) { // Comercial
            const usoComercial = catUsos.data?.find(u => u.label.toLowerCase().includes('comercial'));
            if (usoComercial) idUsoOficial = usoComercial.id;
        }

        const payload = {
            vehiculo: { version: tokenVersion, anio: parseInt(datosAuto.anio), uso: idUsoOficial },
            asegurado: { 
                apellido: "Lead WhatsApp", tipo_persona: 1, 
                provincia: 2, localidad: 706, codigo_postal: datosAuto.codigo_postal.toString() 
            },
            forma_de_pago: idFormaPago
        };

        if (datosAuto.dni) payload.asegurado.dni = datosAuto.dni;
        if (datosAuto.fecha_nacimiento) payload.asegurado.fecha_de_nacimiento = datosAuto.fecha_nacimiento;

        // 🟢 Inyectar GNC con el valor dinámico del Excel
        if (datosAuto.gnc && datosAuto.valorGnc) {
            const resAcc = await fetch(`${BASE_URL}/catalogos/accesorios`, { headers });
            const catAcc = await resAcc.json();
            const gncItem = catAcc.data?.find(a => a.label.toLowerCase().includes('gnc') || a.label.toLowerCase().includes('gas'));
            
            if (gncItem) {
                payload.accesorios = [{ accesorio: gncItem.id, valor: datosAuto.valorGnc }];
            }
        }

        const resCot = await fetch(`${BASE_URL}/cotizaciones/auto`, { method: 'POST', headers, body: JSON.stringify(payload) });
        const jsonCot = await resCot.json();

        if (!resCot.ok || !jsonCot.data || !jsonCot.data.id) return null;

        const ticketId = jsonCot.data.id;
        console.log(`⏳ [WOKER] Ticket #${ticketId} creado (Uso ID: ${idUsoOficial}). Esperando...`);

        let terminada = false;
        while (!terminada) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const resEst = await fetch(`${BASE_URL}/cotizaciones/${ticketId}`, { headers });
            const jsonEst = await resEst.json();
            if (jsonEst.data && jsonEst.data.cotizacion_finalizada) terminada = true;
        }

        const resRes = await fetch(`${BASE_URL}/cotizaciones/${ticketId}/resultados`, { headers });
        const jsonRes = await resRes.json();
        return { ticketId: ticketId, cotizaciones: jsonRes.data?.cotizaciones || [] };

    } catch (error) {
        return null;
    }
}

// Exportamos las dos funciones
module.exports = { obtenerVersionesWoker, cotizarEnWoker };