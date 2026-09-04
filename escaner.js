// PONÉ TU CLAVE REAL ACÁ
const WOKER_API_KEY = "wkr_zScowU4k8Q1NCHZnoDjMXrNNjKwh8C-9DKaVmOKaPPI"; 

async function escanearWoker() {
    console.log("🔍 Entrando a Woker con permisos de Administrador...");
    try {
        const res = await fetch("https://grupoab.woker.ar/api/v1/openapi.json", {
            headers: { 'Authorization': `Bearer ${WOKER_API_KEY}` }
        });
        
        const json = await res.json();
        
        console.log("\n🚗 CAMPOS PERMITIDOS EN 'VEHÍCULO' (AutoVehiculoSchema):");
        console.log(Object.keys(json.components.schemas.AutoVehiculoSchema.properties));
        
        console.log("\n👤 CAMPOS PERMITIDOS EN 'ASEGURADO' (AseguradoSchema):");
        console.log(Object.keys(json.components.schemas.AseguradoSchema.properties));

        // De yapa, miramos cómo se escriben los accesorios por el tema del GNC
        console.log("\n⚙️ CAMPOS PERMITIDOS EN 'ACCESORIOS' (AccesorioSchema):");
        if(json.components.schemas.AccesorioSchema) {
            console.log(Object.keys(json.components.schemas.AccesorioSchema.properties));
        } else {
            console.log("No hay esquema de AccesorioSchema.");
        }

    } catch (error) {
        console.log("❌ Error consultando el esquema:", error.message);
    }
}

escanearWoker();