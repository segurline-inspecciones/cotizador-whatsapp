const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const credenciales = require('./credenciales.json');

const DOCUMENT_ID = '1IOfM1kF3xwZFrH__jQHOfbOuj-XywXGZ9O9_RYO7FY4'; 

async function cargarReglasDeNegocio() {
    console.log("⏳ Descargando reglas desde Google Sheets...");
    try {
        const auth = new JWT({
            email: credenciales.client_email,
            key: credenciales.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(DOCUMENT_ID, auth);
        await doc.loadInfo(); 
        
        const hojaGondola = doc.sheetsByTitle['Gondola_Compañias'];
        
        // 🟢 Cargar GNC (K1) y Texto del Pie de Página (N1)
        await hojaGondola.loadCells(['K1', 'N1']);
        
        const celdaK1 = hojaGondola.getCellByA1('K1').value;
        const valorGncK1 = typeof celdaK1 === 'number' ? celdaK1 : 1500000;

        const celdaN1 = hojaGondola.getCellByA1('N1').value;
        const textoFooterN1 = celdaN1 ? celdaN1.toString() : "💡 Transparencia Total: Comparamos las mejores aseguradoras del país para vos.";

        const filasGondola = await hojaGondola.getRows();
        const reglasGondola = {};
        
        filasGondola.forEach(fila => {
            const idWoker = fila.get('ID Woker');
            if (idWoker) {
                reglasGondola[idWoker] = {
                    nombre: fila.get('Compañía'),
                    orden: parseInt(fila.get('Orden 0-5 años')) || 99, 
                    etiqueta: fila.get('Etiqueta') || fila.get('Etiquetas') || '' 
                };
            }
        });

        const hojaFiltros = doc.sheetsByTitle['Filtro_Coberturas'];
        const filasFiltros = await hojaFiltros.getRows();
        const reglasCoberturas = {};
        
        filasFiltros.forEach(fila => {
            const idCia = fila.get('ID Compañía');
            const codWoker = fila.get('Código Woker');
            
            if (idCia && codWoker) {
                if (!reglasCoberturas[idCia]) reglasCoberturas[idCia] = {};
                reglasCoberturas[idCia][codWoker] = {
                    columnaHtml: fila.get('Columna Destino'),
                    nombreComercial: fila.get('nombre descriptivo')
                };
            }
        });

        console.log(`✅ Reglas listas. GNC: $${valorGncK1} | Pie de página cargado.`);
        return { reglasGondola, reglasCoberturas, valorGncK1, textoFooterN1 };

    } catch (error) {
        console.error("❌ Error leyendo Google Sheets:", error.message);
        return null;
    }
}

module.exports = { cargarReglasDeNegocio };