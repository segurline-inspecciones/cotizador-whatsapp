// Usamos process.env para cuando subamos a Render
const WOKER_API_KEY = process.env.WOKER_API_KEY;
const BASE_URL = "https://grupoab.woker.ar/api/v1";

const headers = { 
    'Authorization': `Bearer ${WOKER_API_KEY}`, 
    'Content-Type': 'application/json' 
};

const normalizarTexto = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

async function obtenerVersionesWoker(marcaTexto, modeloTexto, anio) {
    console.log(`\n🔍 [WOKER] Buscando catálogo para: "${marcaTexto}" "${modeloTexto}" ${anio}...`);
    try {
        const resMarcas = await fetch(`${BASE_URL}/catalogos/marcas?rama=1`, { headers });
        const jsonMarcas = await resMarcas.json();
        
        const marcaBuscada = normalizarTexto(marcaTexto);

        let marcaObj = jsonMarcas.data?.find(m => normalizarTexto(m.label) === marcaBuscada);
        
        if (!marcaObj) {
            marcaObj = jsonMarcas.data?.find(m => {
                const labelNorm = normalizarTexto(m.label);
                return labelNorm.includes(marcaBuscada) || marcaBuscada.includes(labelNorm);
            });
        }

        if (!marcaObj) {
            console.log(`⚠️ [WOKER] No se encontró la marca "${marcaTexto}". Solicitando rescate a IA...`);
            return { error: 'MARCA_NO_ENCONTRADA', opcionesMarcas: jsonMarcas.data || [], versiones: [] };
        }

        const resVers = await fetch(`${BASE_URL}/catalogos/versiones?rama=1&marca=${marcaObj.id}&anio=${anio}&limit=1000&per_page=1000`, { headers });
        const jsonVers = await resVers.json();

        const totalDevueltos = jsonVers.data ? jsonVers.data.length : 0;
        console.log(`📡 [WOKER DEBUG] La API devolvió un total de ${totalDevueltos} versiones crudas para la marca oficial "${marcaObj.label}".`);

        const modeloBuscado = normalizarTexto(modeloTexto);

        const versionesFiltradas = (jsonVers.data || [])
            .filter(v => {
                const verLabel = normalizarTexto(v.label);
                return verLabel.includes(modeloBuscado);
            })
            .map(v => ({ id: v.id, descripcion: v.label }));

        if (versionesFiltradas.length === 0) {
            console.log(`⚠️ [WOKER] Modelo "${modeloTexto}" no encontrado. Solicitando rescate de modelo a IA...`);
            const muestraVersiones = [...new Set((jsonVers.data || []).map(v => v.label))].slice(0, 150);
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
        
        let provBuscada = normalizarTexto(provinciaTexto);
        
        if (provBuscada.includes('caba') || provBuscada.includes('autonoma') || provBuscada.includes('capital federal')) {
            provBuscada = 'capital federal';
        }

        const provObj = catProv.data?.find(p => {
            const labelNorm = normalizarTexto(p.label);
            return labelNorm.includes(provBuscada) || provBuscada.includes(labelNorm) || 
                   (provBuscada === 'capital federal' && (labelNorm.includes('caba') || labelNorm.includes('capital')));
        });

        if (!provObj) {
            console.log(`❌ [WOKER] No se encontró coincidencia para la provincia: ${provinciaTexto}`);
            return { valido: false, error: "PROVINCIA_NO_ENCONTRADA" };
        }
        
        idProv = provObj.id;

        const resLoc = await fetch(`${BASE_URL}/catalogos/localidades?provincia=${idProv}&codigo_postal=${cp}`, { headers });
        const catLoc = await resLoc.json();
        const opciones = catLoc.data || [];

        if (opciones.length === 0) return { valido: false, error: "CP_SIN_LOCALIDADES" };

        const locTextoLimpio = normalizarTexto(localidadTexto);
        const locObj = opciones.find(l => normalizarTexto(l.label) === locTextoLimpio);

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
        const tarjetaCredito = catForma.data?.find(f => normalizarTexto(f.label).includes('tarjeta'));
        const idFormaPago = tarjetaCredito ? tarjetaCredito.id : 2;

        const resUsos = await fetch(`${BASE_URL}/catalogos/usos`, { headers });
        const catUsos = await resUsos.json();
        let idUsoOficial = 1; 
        
        if (datosAuto.uso === 3) { 
            const usoUber = catUsos.data?.find(u => normalizarTexto(u.label).includes('uber') || normalizarTexto(u.label).includes('plataforma'));
            if (usoUber) idUsoOficial = usoUber.id;
        } else if (datosAuto.uso === 2) { 
            const usoComercial = catUsos.data?.find(u => normalizarTexto(u.label).includes('comercial'));
            if (usoComercial) idUsoOficial = usoComercial.id;
        }

        let idCondicionIva = null;
        let idCondicionIibb = null;

        if (datosAuto.uso === 2 || datosAuto.uso === 3) {
            try {
                const resIva = await fetch(`${BASE_URL}/catalogos/iva`, { headers });
                if (resIva.ok) {
                    const catIva = await resIva.json();
                    const ivaMonotributo = catIva.data?.find(i => normalizarTexto(i.label).includes('monotribut'));
                    if (ivaMonotributo) idCondicionIva = ivaMonotributo.id;
                }

                const resIibb = await fetch(`${BASE_URL}/catalogos/ingresos-brutos`, { headers });
                if (resIibb.ok) {
                    const catIibb = await resIibb.json();
                    const iibbConvenio = catIibb.data?.find(i => normalizarTexto(i.label).includes('convenio'));
                    if (iibbConvenio) idCondicionIibb = iibbConvenio.id;
                }
            } catch (e) {
                console.log("⚠️ [WOKER] No se pudieron cargar catálogos de IVA/IIBB para comerciales:", e.message);
            }
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
            forma_de_pago: idFormaPago,
            plan_cotizacion_id: 4
        };

        if (idCondicionIva) payload.asegurado.iva = idCondicionIva;
        if (idCondicionIibb) payload.asegurado.ingresos_brutos = idCondicionIibb;

        if (datosAuto.dni) payload.asegurado.dni = datosAuto.dni.toString();
        if (datosAuto.fecha_nacimiento) payload.asegurado.fecha_de_nacimiento = datosAuto.fecha_nacimiento;

        if (datosAuto.gnc && datosAuto.valorGnc) {
            const resAcc = await fetch(`${BASE_URL}/catalogos/accesorios`, { headers });
            const catAcc = await resAcc.json();
            const gncItem = catAcc.data?.find(a => normalizarTexto(a.label).includes('gnc') || normalizarTexto(a.label).includes('gas'));
            
            if (gncItem) {
                payload.accesorios = [{ accesorio: gncItem.id, valor: datosAuto.valorGnc }];
            }
        }

        console.log("📦 [WOKER DEBUG] Enviando Payload:", JSON.stringify(payload, null, 2));

        // 🟢 MODIFICACIÓN: Cambiamos a 'let' para poder reintentar si falla
        let resCot = await fetch(`${BASE_URL}/cotizaciones/auto`, { method: 'POST', headers, body: JSON.stringify(payload) });
        let jsonCot = await resCot.json();

        // 🟢 NUEVO ESCUDO ANTI-RECHAZO: Reintento sin DNI/Fecha si Woker tira error de validación en esos campos
        if (!resCot.ok && jsonCot.fields) {
            const erroresFields = JSON.stringify(jsonCot.fields).toLowerCase();
            if (erroresFields.includes('dni') || erroresFields.includes('fecha') || erroresFields.includes('nacimiento')) {
                console.log(`⚠️ [WOKER] El DNI o la Fecha de Nacimiento tienen formato inválido. Reintentando cotización sin estos datos optativos...`);
                delete payload.asegurado.dni;
                delete payload.asegurado.fecha_de_nacimiento;
                
                resCot = await fetch(`${BASE_URL}/cotizaciones/auto`, { method: 'POST', headers, body: JSON.stringify(payload) });
                jsonCot = await resCot.json();
                console.log(`✅ [WOKER] Reintento de cotización disparado limpio.`);
            }
        }

        if (!resCot.ok || !jsonCot.data || !jsonCot.data.id) {
            console.log(`❌ [WOKER ERROR] Código de estado HTTP: ${resCot.status}`);
            console.log("❌ [WOKER ERROR] Detalle del rechazo de Woker:", JSON.stringify(jsonCot, null, 2));
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