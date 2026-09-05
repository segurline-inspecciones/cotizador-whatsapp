const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use('/public', express.static('public'));

const moduloSheets = require('./1_modulo_sheets');
const moduloIA = require('./2_modulo_ia');
const moduloWoker = require('./3_modulo_woker');
const moduloImagen = require('./4_modulo_imagen');
const moduloWoztell = require('./5_modulo_woztell');

let reglasNegocio = null;

const memoriaBot = {}; 

app.get('/', (req, res) => res.send('🟢 Cotizador Segurline funcionando ok.'));

app.get('/actualizar-reglas', async (req, res) => {
    reglasNegocio = await moduloSheets.cargarReglasDeNegocio();
    res.send('✅ Reglas actualizadas desde Google Sheets exitosamente.');
});

app.post('/webhook', async (req, res) => {
    res.status(200).send('EVENT_RECEIVED'); 

    const textoCliente = req.body.mensaje || (req.body.data && req.body.data.text ? req.body.data.text : "");
    const numeroCliente = req.body.telefono || req.body.from || "5491169799220"; 
    
    const wozMemberId = req.body.memberId || req.body.member || (req.body.data && req.body.data.member);

    console.log(`\n========================================`);
    if (req.body.datos_vehiculo) {
        console.log(`📩 NUEVO INGRESO POR FLOW (Tel: ${numeroCliente})`);
    } else {
        console.log(`📩 NUEVO MENSAJE: "${textoCliente}" (Tel: ${numeroCliente})`);
    }

    try {
        if (memoriaBot[numeroCliente] && memoriaBot[numeroCliente].estado === "ESPERANDO_VERSION" && !req.body.datos_vehiculo) {
            const numeroElegido = parseInt(textoCliente.trim());
            const sesion = memoriaBot[numeroCliente];

            if (isNaN(numeroElegido) || numeroElegido < 1 || numeroElegido > sesion.opciones.length) {
                console.log(`🙋‍♂️ [SERVIDOR] Opción inválida / Derivado a asesor.`);
                await moduloWoztell.enviarMensajeTexto(numeroCliente, "👨‍💻 Entendido. Un asesor experto se estará poniendo en contacto con vos a la brevedad para realizarte una cotización súper personalizada.");
                if (wozMemberId) await moduloWoztell.activarLiveChat(wozMemberId);
                delete memoriaBot[numeroCliente];
                return;
            }

            const versionSeleccionada = sesion.opciones[numeroElegido - 1];
            console.log(`✅ [SERVIDOR] Cliente eligió la opción ${numeroElegido}: ${versionSeleccionada.descripcion}`);
            await moduloWoztell.enviarMensajeTexto(numeroCliente, "⏳ ¡Excelente! Aguardá unos segundos que estoy generando tu cotización...");

            const datosAuto = sesion.datosAuto;
            delete memoriaBot[numeroCliente]; 
            return await dispararCotizacion(versionSeleccionada.id, datosAuto, numeroCliente, wozMemberId);
        }

        let datosAuto;
        if (req.body.datos_vehiculo) {
            datosAuto = req.body.datos_vehiculo;
            console.log("⚡ [SERVIDOR] Datos limpios recibidos del Flow. Omitiendo extracción con IA...");
            delete memoriaBot[numeroCliente]; 
        } else {
            datosAuto = await moduloIA.extraerDatosVehiculo(textoCliente);
        }

        if (!datosAuto || !datosAuto.listo_para_cotizar) {
            console.log("⚠️ Faltan datos críticos, derivando a asesor...");
            await moduloWoztell.enviarMensajeTexto(numeroCliente, "👨‍💻 Me faltan algunos detalles para cotizar tu seguro automáticamente. ¡No te preocupes! Ya te derivo con un asesor de nuestro equipo para que lo revise y se contacte con vos a la brevedad.");
            if (wozMemberId) await moduloWoztell.activarLiveChat(wozMemberId);
            return;
        }

        let zona = await moduloWoker.obtenerIdZona(datosAuto.provincia, datosAuto.codigo_postal, datosAuto.localidad);

        if (!zona.valido && zona.error === "LOCALIDAD_INCORRECTA") {
            console.log(`⚠️ Localidad "${datosAuto.localidad}" no hace match exacto. Consultando IA para corregir tipeo...`);
            const nombresOpciones = zona.opciones.map(o => o.label);
            const localidadCorregida = await moduloIA.corregirLocalidadIA(datosAuto.localidad, nombresOpciones);

            if (localidadCorregida) {
                console.log(`🧠 IA corrigió la localidad a: ${localidadCorregida}`);
                datosAuto.localidad = localidadCorregida;
                zona = await moduloWoker.obtenerIdZona(datosAuto.provincia, datosAuto.codigo_postal, datosAuto.localidad);
            }
        }

        if (!zona.valido) {
            console.log(`❌ Zona inválida (${zona.error}). Derivando a asesor...`);
            await moduloWoztell.enviarMensajeTexto(numeroCliente, "👨‍💻 Por tu zona de residencia (Código Postal o Localidad), necesitamos hacer una validación manual de riesgo para darte el precio exacto. Te derivo a un asesor que se estará comunicando con vos muy pronto.");
            if (wozMemberId) await moduloWoztell.activarLiveChat(wozMemberId);
            return;
        }

        datosAuto.idProvincia = zona.idProvincia;
        datosAuto.idLocalidad = zona.idLocalidad;

        let resWoker = await moduloWoker.obtenerVersionesWoker(datosAuto.marca, datosAuto.modelo, datosAuto.anio);
        
        if (resWoker.error === "MARCA_NO_ENCONTRADA") {
            console.log(`⚠️ Marca "${datosAuto.marca}" no hace match exacto. Consultando IA para corregir...`);
            const nombresMarcas = resWoker.opcionesMarcas.map(m => m.label);
            const marcaCorregida = await moduloIA.corregirMarcaIA(datosAuto.marca, nombresMarcas);

            if (marcaCorregida) {
                console.log(`🧠 IA corrigió la marca a: ${marcaCorregida}`);
                datosAuto.marca = marcaCorregida;
                resWoker = await moduloWoker.obtenerVersionesWoker(datosAuto.marca, datosAuto.modelo, datosAuto.anio);
            }
        }

        const versiones = resWoker.versiones || [];
        
        if (versiones.length === 0) {
            console.log("❌ Sin versiones para ese modelo, derivando a asesor...");
            await moduloWoztell.enviarMensajeTexto(numeroCliente, "👨‍💻 Tu vehículo requiere una cotización especial. Un asesor experto de nuestro equipo está buscando el mejor precio y se contactará con vos por este chat en breve.");
            if (wozMemberId) await moduloWoztell.activarLiveChat(wozMemberId);
            return;
        }

        const decision = await moduloIA.arbitroDeVersiones(datosAuto.version_buscada, versiones);
        
        if (!decision || !decision.seguro) {
            console.log("\n⚠️ [SERVIDOR] Múltiples versiones. Enviando TEXTO CON MEMORIA...");
            
            let textoOpciones = `Encontré varias versiones para tu *${datosAuto.marca} ${datosAuto.modelo} ${datosAuto.anio}*.\n\nPor favor, indicá la correcta:\n\n`;
            
            let numOp = 1;
            if (decision && decision.opciones) {
                decision.opciones.slice(0, 6).forEach((op) => {
                    textoOpciones += `${numOp}️⃣ *${op.descripcion}*\n\n`;
                    numOp++;
                });
            }
            
            textoOpciones += ` *${numOp}️⃣ 🙋‍♂️ Ninguna de estas. Hablar con asesor.*\n\n👉 *Respondé únicamente con el número* correspondiente.`;
            
            memoriaBot[numeroCliente] = { estado: "ESPERANDO_VERSION", opciones: decision.opciones.slice(0, 6), datosAuto: datosAuto };
            await moduloWoztell.enviarMensajeTexto(numeroCliente, textoOpciones);
            return; 
        }

        await dispararCotizacion(decision.id_elegido, datosAuto, numeroCliente, wozMemberId);

    } catch (error) {
        console.error("❌ Error general:", error.message);
    }
});

async function dispararCotizacion(idWoker, datosAuto, numeroCliente, wozMemberId) {
    try {
        if (!reglasNegocio) {
            console.log("⚠️ [SERVIDOR] Reglas no encontradas en memoria. Descargando desde Google Sheets...");
            reglasNegocio = await moduloSheets.cargarReglasDeNegocio();
            if (!reglasNegocio) {
                console.log("❌ Error fatal: No se pudieron cargar las reglas de Google Sheets.");
                await moduloWoztell.enviarMensajeTexto(numeroCliente, "👨‍💻 Tenemos un problema técnico conectando con los servidores. Te derivo a un asesor para que te ayude manualmente.");
                if (wozMemberId) await moduloWoztell.activarLiveChat(wozMemberId);
                return;
            }
        }

        datosAuto.valorGnc = reglasNegocio.valorGncK1; 
        const wokerData = await moduloWoker.cotizarEnWoker(idWoker, datosAuto);
        
        if (!wokerData || wokerData.error) {
            console.log("⚠️ [SERVIDOR] Cotización fallida en Woker, derivando a asesor...");
            await moduloWoztell.enviarMensajeTexto(numeroCliente, "👨‍💻 Tuvimos un pequeño inconveniente técnico al conectar con las aseguradoras. Ya te derivo con un asesor para que genere tu cotización manualmente y te la envíe por este medio.");
            if (wozMemberId) await moduloWoztell.activarLiveChat(wozMemberId);
            return;
        }

        const resultadosWoker = wokerData.cotizaciones;
        const ticketId = wokerData.ticketId;
        
        console.log("🔀 [SERVIDOR] Mapeando precios...");
        let contadorOpcion = 1;
        const companiasProcesadas = [];

        resultadosWoker.forEach(comp => {
            const idCiaWoker = comp.compania.id.toString();
            const reglasGondola = reglasNegocio.reglasGondola[idCiaWoker];
            const reglasFiltros = reglasNegocio.reglasCoberturas[idCiaWoker];

            if (!reglasGondola || !reglasFiltros) return; 

            let valorSuma = comp.suma_asegurada || (comp.coberturas[0] ? comp.coberturas[0].suma_asegurada : 0);
            if (!valorSuma || valorSuma === 0) valorSuma = 6500000; 
            
            const sumaAsgGeneral = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valorSuma);

            let sumaGncVisual = null;
            if (datosAuto.gnc && datosAuto.valorGnc) {
                // 🟢 FIX 2: Limpiamos los signos raros del GNC para que la matemática no se rompa
                const gncNumerico = Number(datosAuto.valorGnc.toString().replace(/[^0-9]/g, '')) || 0;
                const topeVeintePorciento = valorSuma * 0.20;
                const gncDefinitivo = Math.min(gncNumerico, topeVeintePorciento);
                
                if (gncDefinitivo > 0) {
                    sumaGncVisual = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(gncDefinitivo);
                }
            }

            let nombreLogo = reglasGondola.nombre.toLowerCase().replace(/ /g, '-');
            if (nombreLogo.includes('mercantil')) nombreLogo = 'mercantil'; 
            if (nombreLogo.includes('sancor')) nombreLogo = 'sancor';
            if (nombreLogo.includes('atm')) nombreLogo = 'atm';

            // 🟢 FIX 3: Convertimos cualquier emoji del Sheet en imagen de Twemoji
            const etiquetaOriginal = (reglasGondola.etiqueta || "").trim();
            const etiquetaHtml = etiquetaOriginal.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, (m) => {
                return `<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${m.codePointAt(0).toString(16)}.png" style="width: 13px; height: 13px; vertical-align: text-bottom; margin-right: 4px;">`;
            });
            const esOferta = etiquetaOriginal.toLowerCase().includes('oferta');

            const filaDiseno = {
                nombre: reglasGondola.nombre,
                orden: reglasGondola.orden,
                etiqueta_html: etiquetaHtml, 
                es_oferta: esOferta,
                logoBase64: moduloImagen.getBase64Image(`${nombreLogo}.jpg`), 
                sumaAsg: sumaAsgGeneral,
                sumaGnc: sumaGncVisual 
            };

            if (comp.coberturas) {
                comp.coberturas.forEach(cob => {
                    const nombreComercial = (cob.descripcion || cob.nombre || "").trim();
                    const codigoNumerico = (cob.cobertura || "").toString();
                    
                    const reglaCob = reglasFiltros[nombreComercial] || reglasFiltros[codigoNumerico];
                    
                    if (reglaCob) {
                        const precioFormat = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(cob.premio);
                        let textoDesc = reglaCob.nombreComercial ? reglaCob.nombreComercial.substring(0, 80) : "";
                        
                        if (reglaCob.columnaHtml === "RESPONSABILIDAD CIVIL" && !filaDiseno.rc) { filaDiseno.rc = precioFormat; filaDiseno.opt_rc = contadorOpcion++; filaDiseno.desc_rc = textoDesc; }
                        if (reglaCob.columnaHtml === "TERCEROS BÁSICOS" && !filaDiseno.tb) { filaDiseno.tb = precioFormat; filaDiseno.opt_tb = contadorOpcion++; filaDiseno.desc_tb = textoDesc; }
                        if (reglaCob.columnaHtml === "TERCEROS COMPLETO FULL" && !filaDiseno.tc) { filaDiseno.tc = precioFormat; filaDiseno.opt_tc = contadorOpcion++; filaDiseno.desc_tc = textoDesc; }
                        if (reglaCob.columnaHtml === "TODO RIESGO FRANQUICIA BAJA" && !filaDiseno.tr_baja) { filaDiseno.tr_baja = precioFormat; filaDiseno.opt_tr_baja = contadorOpcion++; filaDiseno.desc_tr_baja = textoDesc; }
                        if (reglaCob.columnaHtml === "TODO RIESGO FRANQUICIA ALTA" && !filaDiseno.tr_alta) { filaDiseno.tr_alta = precioFormat; filaDiseno.opt_tr_alta = contadorOpcion++; filaDiseno.desc_tr_alta = textoDesc; }
                    }
                });
            }

            const tieneAlgunPrecio = filaDiseno.rc || filaDiseno.tb || filaDiseno.tc || filaDiseno.tr_baja || filaDiseno.tr_alta;
            if (tieneAlgunPrecio) companiasProcesadas.push(filaDiseno);
        });

        companiasProcesadas.sort((a, b) => a.orden - b.orden);

        const vehiculoString = { 
            nombreCompleto: `${datosAuto.marca} ${datosAuto.modelo} ${datosAuto.anio}`,
            ticketId: ticketId,
            logoEmpresa: moduloImagen.getBase64Image('logo.png'), 
            footerDinamico: reglasNegocio.textoFooterN1 
        };
        
        const bufferImagen = await moduloImagen.generarImagenCotizacion(vehiculoString, companiasProcesadas);

       if (bufferImagen) {
            if (!fs.existsSync('./public')) {
                fs.mkdirSync('./public');
            }

            fs.writeFileSync('./public/cotizacion_final_test.png', bufferImagen);
            console.log("\n🎉 ¡ÉXITO TOTAL! Imagen guardada y lista.");

            const baseUrl = process.env.RENDER_EXTERNAL_URL || `https://cotizador-whatsapp.onrender.com`;
            const urlPublicaImg = `${baseUrl}/public/cotizacion_final_test.png`;
            
            await moduloWoztell.enviarImagen(numeroCliente, urlPublicaImg);

            await moduloWoztell.enviarMensajeTexto(numeroCliente, "👉 ¡Acá tenés tu cotización! Por favor, escribí únicamente el *NÚMERO* de la cobertura que más te interesó.\n\n De esta manera podemos enviarte el detalle completo de la cobertura y los pasos para contratarla.");
            if (wozMemberId) await moduloWoztell.activarLiveChat(wozMemberId);
        }

    } catch (error) {
        console.error("❌ Error en cotización:", error.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Servidor en línea en el puerto ${PORT}`);
    reglasNegocio = await moduloSheets.cargarReglasDeNegocio();
});