// Usamos process.env para cuando subamos a Render, o tu clave fija para probar ahora
const WOKER_API_KEY = process.env.WOKER_API_KEY ;
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

// 2. Dispara la cotización oficial
async function cotizarEnWoker(tokenVersion, datosAuto) {
    console.log(`\n🚀 [WOKER] Disparando cotización oficial...`);
    try {
        // --- A. FORMA DE PAGO ---
        const resForma = await fetch(`${BASE_URL}/catalogos/forma-pago`, { headers });
        const catForma = await resForma.json();
        const tarjetaCredito = catForma.data?.find(f => f.label.toLowerCase().includes('tarjeta'));
        const idFormaPago = tarjetaCredito ? tarjetaCredito.id : 2;

        // --- B. USO DEL VEHÍCULO ---
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

        // --- C. PROVINCIA Y LOCALIDAD DINÁMICAS ---
        let idProvincia = 2; // Default Capital/BA
        let idLocalidad = 706; // Default
        
        try {
            if (datosAuto.provincia) {
                const resProv = await fetch(`${BASE_URL}/catalogos/provincias`, { headers });
                const catProv = await resProv.json();
                const provObj = catProv.data?.find(p => p.label.toLowerCase().includes(datosAuto.provincia.toLowerCase().trim()));
                
                if (provObj) {
                    idProvincia = provObj.id;
                    const resLoc = await fetch(`${BASE_URL}/catalogos/localidades?provincia=${idProvincia}`, { headers });
                    const catLoc = await resLoc.json();
                    
                    // Buscamos la localidad que coincida con el CP del cliente
                    const cpBuscado = datosAuto.codigo_postal.toString();
                    const locObj = catLoc.data?.find(l => 
                        (l.codigo_postal && l.codigo_postal.toString() === cpBuscado) || 
                        (l.cp && l.cp.toString() === cpBuscado)
                    );
                    
                    if (locObj) idLocalidad = locObj.id;
                }
            }
        } catch (error) {
            console.log("⚠️ [WOKER] Falló la búsqueda dinámica de localidad. Usando defaults.");
        }

        // --- D. ARMADO DEL PAQUETE ---
        const payload = {
            vehiculo: { version: tokenVersion, anio: parseInt(datosAuto.anio), uso: idUsoOficial },
            asegurado: { 
                apellido: "Lead WhatsApp", 
                tipo_persona: 1, 
                provincia: idProvincia, 
                localidad: idLocalidad, 
                codigo_postal: datosAuto.codigo_postal.toString() 
            },
            forma_de_pago: idFormaPago
        };

        // Datos opcionales
        if (datosAuto.dni) payload.asegurado.dni = datosAuto.dni.toString();

        // Escudo protector para Fechas de Nacimiento (Meta manda timestamps numéricos)
        if (datosAuto.fecha_nacimiento) {
            try {
                const fecha = new Date(Number(datosAuto.fecha_nacimiento));
                if (!isNaN(fecha.getTime())) {
                    const anio = fecha.getFullYear();
                    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
                    const dia = String(fecha.getDate()).padStart(2, '0');
                    payload.asegurado.fecha_de_nacimiento = `${anio}-${mes}-${dia}`;
                } else {
                    payload.asegurado.fecha_de_nacimiento = datosAuto.fecha_nacimiento; // Fallback
                }
            } catch (e) {
                payload.asegurado.fecha_de_nacimiento = datosAuto.fecha_nacimiento;
            }
        }

        // --- E. ACCESORIOS (GNC) ---
        if (datosAuto.gnc && datosAuto.valorGnc) {
            const resAcc = await fetch(`${BASE_URL}/catalogos/accesorios`, { headers });
            const catAcc = await resAcc.json();
            const gncItem = catAcc.data?.find(a => a.label.toLowerCase().includes('gnc') || a.label.toLowerCase().includes('gas'));
            
            if (gncItem) {
                payload.accesorios = [{ accesorio: gncItem.id, valor: datosAuto.valorGnc }];
            }
        }

        // 🐞 MODO DEBUG: Imprimimos qué le estamos mandando exactamente a Woker
        console.log("📦 [WOKER DEBUG] Enviando Payload:", JSON.stringify(payload, null, 2));

        // --- F. DISPARO A WOKER ---
        const resCot = await fetch(`${BASE_URL}/cotizaciones/auto`, { method: 'POST', headers, body: JSON.stringify(payload) });
        const jsonCot = await resCot.json();

        // 🐞 MODO DEBUG: Atrapamos el error exacto si nos rebota
        if (!resCot.ok || !jsonCot.data || !jsonCot.data.id) {
            console.log("❌ [WOKER ERROR] La API rechazó la cotización. Respuesta de Woker:");
            console.log(JSON.stringify(jsonCot, null, 2));
            return null;
        }

        const ticketId = jsonCot.data.id;
        console.log(`⏳ [WOKER] Ticket #${ticketId} creado. Esperando resultados...`);

        // Polling para esperar que termine de cotizar
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
        return null;
    }
}

module.exports = { obtenerVersionesWoker, cotizarEnWoker };