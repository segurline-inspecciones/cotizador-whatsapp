require('dotenv').config();

// Función interna: Obtener un Access Token fresco usando el Refresh Token (con fetch nativo)
async function getAccessToken() {
    try {
        const params = new URLSearchParams({
            refresh_token: process.env.ZOHO_REFRESH_TOKEN,
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            grant_type: 'refresh_token'
        });

        const response = await fetch(`${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token?${params.toString()}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(JSON.stringify(data));
        }

        return data.access_token;
    } catch (error) {
        console.error('❌ [ZOHO] Error obteniendo el Access Token:', error.message);
        throw error;
    }
}

// Función principal: Crear el Lead en Zoho CRM tras una cotización exitosa
async function crearLeadZoho(datosAuto, ticketId, nombreVersionOficial, telefonoCliente) {
    try {
        console.log('🔄 [ZOHO] Obteniendo autorización temporal para Zoho CRM...');
        const accessToken = await getAccessToken();

        // Definimos la versión o un genérico para usar en el nombre/apellido
        const versionVehiculo = nombreVersionOficial || datosAuto.version_buscada || datosAuto.modelo || 'Vehículo';
        const telefonoStr = telefonoCliente ? telefonoCliente.toString() : 'Sin teléfono';

        // Armamos el objeto de campos según los nombres de API solicitados
        const leadRecord = {
            Last_Name: `Lead WhatsApp ${versionVehiculo} - ${telefonoStr}`,
            Phone: telefonoCliente ? telefonoCliente.toString() : undefined,
            Lead_Source: "WhatsApp Api Auto",
            Tipo_de_seguro: "Auto", // 🟢 Campo agregado por defecto
            n_de_presupuesto: ticketId ? ticketId.toString() : undefined,
            Marca: datosAuto.marca || undefined,
            Modelo: datosAuto.modelo || undefined,
            A_o: datosAuto.anio ? parseInt(datosAuto.anio) : undefined,
            Version: versionVehiculo,
            State: datosAuto.provincia || undefined,
            City: datosAuto.localidad || undefined,
            Zip_Code: datosAuto.codigo_postal ? datosAuto.codigo_postal.toString() : undefined
        };

        // Campos opcionales (validando por si el cliente no los completó)
        if (datosAuto.fecha_nacimiento && datosAuto.fecha_nacimiento.trim() !== "") {
            leadRecord.F_Nacimiento = datosAuto.fecha_nacimiento;
        }
        if (datosAuto.dni && datosAuto.dni.toString().trim() !== "") {
            leadRecord.DNI_Cotizacion = datosAuto.dni.toString();
        }

        // Limpiamos propiedades que puedan ir en undefined para que Zoho no se queje
        Object.keys(leadRecord).forEach(key => leadRecord[key] === undefined && delete leadRecord[key]);

        const payloadZoho = {
            data: [leadRecord],
            trigger: ["workflow", "approval", "blueprint"]
        };

        console.log('📤 [ZOHO] Enviando Lead a Zoho CRM...', JSON.stringify(payloadZoho, null, 2));
        
        const response = await fetch(`${process.env.ZOHO_API_URL}/Leads`, {
            method: 'POST',
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadZoho)
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(JSON.stringify(responseData));
        }

        const resultado = responseData.data[0];
        
        if (resultado.status === 'success') {
            console.log('✅ [ZOHO] ¡Lead creado exitosamente en Zoho CRM!');
            console.log('🆔 ID del Lead en Zoho:', resultado.details.id);
            return { success: true, id: resultado.details.id };
        } else {
            console.log('⚠️ [ZOHO] El lead se envió, pero Zoho respondió con una advertencia/error:');
            console.log(resultado);
            return { success: false, error: resultado };
        }

    } catch (error) {
        console.error('❌ [ZOHO] Error creando el Lead en Zoho CRM:');
        console.error(error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { crearLeadZoho };