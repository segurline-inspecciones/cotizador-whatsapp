// Usamos process.env para cuando subamos a Render
const WOKER_API_KEY = process.env.WOKER_API_KEY;
const BASE_URL = "https://grupoab.woker.ar/api/v1";

const headers = { 
    'Authorization': `Bearer ${WOKER_API_KEY}`, 
    'Content-Type': 'application/json' 
};

// 1. Busca la marca y pre-filtra las versiones por modelo
async function obtenerVersionesWoker(marcaTexto, modeloTexto, anio) {
    console.log(`\n🔍 [WOKER] Buscando catálogo para: "${marcaTexto}" "${modeloTexto}" ${anio}...`);
    try {
        const resMarcas = await fetch(`${BASE_URL}/catalogos/marcas?rama=1`, { headers });
        const jsonMarcas = await resMarcas.json();
        
        const marcaBuscada = (marcaTexto || "").toLowerCase().replace(/\s+/g, ' ').trim();

        // 🟢 FIX DEFINITIVO: Primero buscamos coincidencia EXACTA para evitar que "Renault" atrape a "Renault Trucks"
        let marcaObj = jsonMarcas.data?.find(m => m.label.toLowerCase().trim() === marcaBuscada);
        
        // Si no hay match exacto, usamos el match parcial (ej: "Chevy" para "Chevrolet")
        if (!marcaObj) {
            marcaObj = jsonMarcas.data?.find(m => {
                const labelNorm = m.label.toLowerCase().trim();
                return labelNorm.includes(marcaBuscada) || marcaBuscada.includes(labelNorm);
            });
        }

        if (!marcaObj) {
            console.log(`⚠️ [WOKER] No se encontró la marca "${marcaTexto}". Solicitando rescate a IA...`);
            return { error: 'MARCA_NO_ENCONTRADA', opcionesMarcas: jsonMarcas.data || [], versiones: [] };
        }

        // Limit=1000 fuerza a que traiga TODO el catálogo de ese año sin ocultar autos
        const resVers = await fetch(`${BASE_URL}/catalogos/versiones?rama=1&marca=${marcaObj.id}&anio=${anio}&limit=1000&per_page=1000`, { headers });
        const jsonVers = await resVers.json();

        const totalDevueltos = jsonVers.data ? jsonVers.data.length : 0;
        console.log(`📡 [WOKER DEBUG] La API devolvió un total de ${totalDevueltos} versiones crudas para la marca oficial "${marcaObj.label}".`);

        const modeloBuscado = (modeloTexto || "").toLowerCase().replace(/\s+/g, ' ').trim();

        const versionesFiltradas = (jsonVers.data || [])
            .filter(v => {
                const verLabel = (v.label || "").toLowerCase().replace(/\s+/g, ' ');
                return verLabel.includes(modeloBuscado);
            })
            .map(v => ({ id: v.id, descripcion: v.label }));

        
        // PREPARACIÓN PARA IA: Si no encuentra el modelo, mandamos una muestra de nombres completos
        if (versionesFiltradas.length === 0) {
            console.log(`⚠️ [WOKER] Modelo "${modeloTexto}" no encontrado. Solicitando rescate de modelo a IA...`);
            // 🟢 FIX: En lugar de la 1er palabra, mandamos una muestra de hasta 60 nombres completos
            const muestraVersiones = [...new Set((jsonVers.data || []).map(v => v.label))].slice(0, 60);
            return { error: 'MODELO_NO_ENCONTRADO', opcionesModelos: muestraVersiones, versiones: [] };
        }

        console.log(`✅ [WOKER] Se encontraron ${versionesFiltradas.length} versiones pre-filtradas para "${modeloBuscado}".`);
        return { error: null, versiones: versionesFiltradas };
    } catch (error) {
        console.error("❌ [WOKER] Error buscando versiones:", error.message);
        return { error: 'ERROR_API', versiones: [] };
    }
}

async function obtenerIdZona(provinciaTexto, cp, localidadTexto) {
    try {
        let idProv = null;
        const resProv = await fetch(`${BASE_URL}/catalogos/provincias`, { headers });
        const catProv = await resProv.json();
        const provObj = catProv.data?.find(p => p.label.toLowerCase().includes(provinciaTexto.toLowerCase().trim()));

        if (!provObj) return { valido: false, error: "PROVINCIA_NO_ENCONTRADA" };
        idProv = provObj.id;

        const resLoc = await fetch(`${BASE_URL}/catalogos/localidades?provincia=${idProv}&codigo_postal=${cp}`, { headers });
        const catLoc = await resLoc.json();
        const opciones = catLoc.data || [];

        if (opciones.length === 0) return { valido: false, error: "CP_SIN_LOCALIDADES" };

        const locTextoLimpio = localidadTexto.toLowerCase().trim();
        const locObj = opciones.find(l => l.label.toLowerCase().trim() === locTextoLimpio);

        if (locObj) {
            return { valido: true, idProvincia: idProv, idLocalidad: locObj.id };
        } else {
            return { valido: false, error: "LOCALIDAD_INCORRECTA", idProvincia: idProv, opciones: opciones };
        }
    } catch (e) {
        return { valido: false, error: "ERROR_API" };
    }
}

async function cotizarEnWoker(tokenVersion, datosAuto) {
    console.log(`\n🚀 [WOKER] Disparando cotización oficial...`);
    try {
        const resForma = await fetch(`${BASE_URL}/catalogos/forma-pago`, { headers });
        const catForma = await resForma.json();
        const tarjetaCredito = catForma.data?.find(f => f.label.toLowerCase().includes('tarjeta'));
        const idFormaPago = tarjetaCredito ? tarjetaCredito.id : 2;

        const resUsos = await fetch(`${BASE_URL}/catalogos/usos`, { headers });
        const catUsos = await resUsos.json();
        let idUsoOficial = 1; 
        
        if (datosAuto.uso === 3) { 
            const usoUber = catUsos.data?.find(u => u.label.toLowerCase().includes('uber') || u.label.toLowerCase().includes('plataforma'));
            if (usoUber) idUsoOficial = usoUber.id;
        } else if (datosAuto.uso === 2) { 
            const usoComercial = catUsos.data?.find(u => u.label.toLowerCase().includes('comercial'));
            if (usoComercial) idUsoOficial = usoComercial.id;
        }

        const payload = {
            vehiculo: { version: tokenVersion, anio: parseInt(datosAuto.anio), uso: idUsoOficial },
            asegurado: { 
                apellido: "Lead WhatsApp", 
                tipo_persona: 1, 
                provincia: datosAuto.idProvincia, 
                localidad: datosAuto.idLocalidad, 
                codigo_postal: datosAuto.codigo_postal.toString() 
            },
            forma_de_pago: idFormaPago
        };

        if (datosAuto.dni) payload.asegurado.dni = datosAuto.dni.toString();
        if (datosAuto.fecha_nacimiento) payload.asegurado.fecha_de_nacimiento = datosAuto.fecha_nacimiento;

        if (datosAuto.gnc && datosAuto.valorGnc) {
            const resAcc = await fetch(`${BASE_URL}/catalogos/accesorios`, { headers });
            const catAcc = await resAcc.json();
            const gncItem = catAcc.data?.find(a => a.label.toLowerCase().includes('gnc') || a.label.toLowerCase().includes('gas'));
            
            if (gncItem) {
                payload.accesorios = [{ accesorio: gncItem.id, valor: datosAuto.valorGnc }];
            }
        }

        console.log("📦 [WOKER DEBUG] Enviando Payload:", JSON.stringify(payload, null, 2));

        const resCot = await fetch(`${BASE_URL}/cotizaciones/auto`, { method: 'POST', headers, body: JSON.stringify(payload) });
        const jsonCot = await resCot.json();

        if (!resCot.ok || !jsonCot.data || !jsonCot.data.id) {
            console.log("❌ [WOKER ERROR] La API rechazó la cotización.");
            return { error: 'COTIZACION_RECHAZADA' };
        }

        const ticketId = jsonCot.data.id;
        console.log(`⏳ [WOKER] Ticket #${ticketId} creado. Esperando resultados...`);

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
        console.error("❌ [WOKER CATCH] Error crítico en la función:", error.message);
        return { error: 'ERROR_CRITICO' };
    }
}

module.exports = { obtenerVersionesWoker, obtenerIdZona, cotizarEnWoker };