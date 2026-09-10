const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const BASE_URL = "https://grupoab.woker.ar/api/v1";
const API_KEY = process.env.WOKER_API_KEY || "TU_API_KEY_AQUI"; 


async function armarCotizacionWeb(ticketId, reglasNegocio) {
    try {
        const headers = { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
        const resResultados = await fetch(`${BASE_URL}/cotizaciones/${ticketId}/resultados`, { headers });
        const wokerData = await resResultados.json();

        if (!wokerData.data || wokerData.data.length === 0) return { error: "No se encontraron resultados" };

        const resultadosWoker = wokerData.data.cotizaciones || wokerData.data;
        const companiasProcesadas = [];
        let sumaAseguradaGlobal = 0;

        resultadosWoker.forEach(comp => {
            const idCiaWoker = comp.compania.id.toString();
            const reglasGondola = reglasNegocio.reglasGondola[idCiaWoker];
            const reglasFiltros = reglasNegocio.reglasCoberturas[idCiaWoker];

            if (!reglasGondola || !reglasFiltros) return;

            let valorSuma = comp.suma_asegurada || (comp.coberturas[0] ? comp.coberturas[0].suma_asegurada : 0);
            if (valorSuma > sumaAseguradaGlobal) sumaAseguradaGlobal = valorSuma;

            let nombreLogo = reglasGondola.nombre.toLowerCase().replace(/ /g, '-');
            if (nombreLogo.includes('mercantil')) nombreLogo = 'mercantil';
            if (nombreLogo.includes('sancor')) nombreLogo = 'sancor';
            if (nombreLogo.includes('atm')) nombreLogo = 'atm';

            const ciaLimpia = {
                id: idCiaWoker,
                nombre: reglasGondola.nombre,
                orden: reglasGondola.orden,
                logo: `${nombreLogo}.jpg`,
                recomendado: (reglasGondola.etiqueta || "").toLowerCase().includes('recomendado'),
                opciones: []
            };

            let contador = 1;
            comp.coberturas.forEach(cob => {
                const nombreComercial = (cob.descripcion || cob.nombre || "").trim();
                const codigoNumerico = (cob.cobertura || "").toString();
                const textoFranquicia = (cob.franquicia || "").toString();
                
                let reglaCob = null;
                for (const [keySheet, regla] of Object.entries(reglasFiltros)) {
                    if (keySheet.includes('|')) {
                        const partes = keySheet.split('|').map(p => p.trim());
                        if ((nombreComercial === partes[0] || codigoNumerico === partes[0]) && textoFranquicia.includes(partes[1])) {
                            reglaCob = regla; break;
                        }
                    } else if (keySheet === nombreComercial || keySheet === codigoNumerico) {
                        if (!reglaCob) reglaCob = regla; 
                    }
                }

                if (reglaCob && cob.premio > 0) {
                    ciaLimpia.opciones.push({
                        id: Number(`${idCiaWoker}${contador}`),
                        tipo: reglaCob.nombreComercial || reglaCob.columnaHtml,
                        precio: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(cob.premio),
                        detalle: "Cobertura completa. Consulte condiciones generales." // Luego lo ataremos a la nueva pestaña de detalles
                    });
                    contador++;
                }
            });

            if (ciaLimpia.opciones.length > 0) companiasProcesadas.push(ciaLimpia);
        });

        companiasProcesadas.sort((a, b) => a.orden - b.orden);
        
        return {
            ticket: ticketId,
            vehiculo: "Vehículo a Cotizar", // Lo podemos pasar por parámetro o guardarlo en memoria
            sumaAsegurada: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(sumaAseguradaGlobal),
            companias: companiasProcesadas
        };

    } catch (error) {
        console.error("Error en módulo web:", error);
        return { error: "Falla interna de conexión." };
    }
}
module.exports = { armarCotizacionWeb };