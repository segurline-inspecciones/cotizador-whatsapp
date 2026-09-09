const WOZTELL_TOKEN = process.env.WOZTELL_TOKEN;
const WOZTELL_CHANNEL_ID = process.env.WOZTELL_CHANNEL_ID;

async function enviarMensajeTexto(numeroDestino, texto) {
    console.log(`\n📫 [WOZTELL] Enviando texto simple a ${numeroDestino}...`);
    const url = `https://bot.api.woztell.com/sendResponses?accessToken=${WOZTELL_TOKEN}`;
    
    const payload = {
        channelId: WOZTELL_CHANNEL_ID,
        recipientId: numeroDestino,
        response: [
            { type: "TEXT", text: texto }
        ]
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.ok === 1) {
            console.log("✅ [WOZTELL] ¡Texto enviado con éxito!");
        } else {
            console.log("❌ [WOZTELL] Error de la API:", data);
        }
        return data;
    } catch (error) {
        console.error("❌ [WOZTELL] Falla de conexión:", error.message);
    }
}

async function enviarImagen(numeroDestino, urlImagen) {
    console.log(`\n🖼️ [WOZTELL] Enviando imagen a ${numeroDestino}...`);
    const url = `https://bot.api.woztell.com/sendResponses?accessToken=${WOZTELL_TOKEN}`;
    
    const payload = {
        channelId: WOZTELL_CHANNEL_ID,
        recipientId: numeroDestino,
        response: [
            { type: "IMAGE", url: urlImagen }
        ]
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok === 1) console.log("✅ [WOZTELL] ¡Imagen enviada con éxito!");
        else console.log("❌ [WOZTELL] Error al enviar imagen:", data);
        return data;
    } catch (error) {
        console.error("❌ [WOZTELL] Falla de conexión:", error.message);
    }
}

// 🟢 NUEVA FUNCIÓN: Enciende el Live Chat vía Open API de Woztell
async function activarLiveChat(memberId) {
    if (!memberId) return console.log("⚠️ [WOZTELL] Faltó el memberId para activar Live Chat.");
    console.log(`\n👨‍💻 [WOZTELL] Activando Live Chat para el member ${memberId}...`);
    
    const url = `https://open.api.woztell.com/v3?accessToken=${WOZTELL_TOKEN}`;
    const query = `
    mutation ToggleLiveChat($input: toggleLiveChatInput!) {
        toggleLiveChat(input: $input) { ok err err_code }
    }`;
    const variables = { input: { memberId: memberId, liveChat: true } };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        const data = await res.json();
        
        if (data.data && data.data.toggleLiveChat && data.data.toggleLiveChat.ok === 1) {
            console.log("✅ [WOZTELL] ¡Live Chat activado exitosamente en la plataforma!");
        } else {
            console.log("❌ [WOZTELL] Error al activar Live Chat. Respuesta de Meta/Woztell:", JSON.stringify(data));
        }
    } catch (error) {
        console.error("❌ [WOZTELL] Falla de conexión en Live Chat:", error.message);
    }
}

// 🚀 NUEVO V2: Disparador de Plantilla de Meta Interactiva
async function enviarPlantillaMeta(numeroDestino, nombrePlantilla) {
    console.log(`\n📲 [WOZTELL] Enviando plantilla interactiva '${nombrePlantilla}' a ${numeroDestino}...`);
    const url = `https://bot.api.woztell.com/sendResponses?accessToken=${WOZTELL_TOKEN}`;
    
    // Replicamos la estructura exacta de tu Zoho CRM
    const payload = {
        channelId: WOZTELL_CHANNEL_ID,
        recipientId: numeroDestino,
        response: [
            { 
                type: "TEMPLATE", 
                elementName: nombrePlantilla,
                languageCode: "es_AR",
                components: [] // 🟢 El secreto de Zoho: Inicializamos la lista vacía
            }
        ]
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.ok === 1) {
            console.log("✅ [WOZTELL] ¡Plantilla enviada con éxito!");
        } else {
            console.log("❌ [WOZTELL] Error al enviar plantilla:", JSON.stringify(data));
        }
        return data;
    } catch (error) {
        console.error("❌ [WOZTELL] Falla de conexión al enviar plantilla:", error.message);
    }
}

// 🟢 NUEVA FUNCIÓN: Teletransporta al usuario a un nodo específico en Woztell
async function redirigirANodo(numeroDestino, treeId, nodeId) {
    console.log(`\n🔀 [WOZTELL] Redirigiendo cliente ${numeroDestino} al nodo ${nodeId}...`);
    const url = `https://bot.api.woztell.com/redirectMemberToNode?accessToken=${WOZTELL_TOKEN}`;

    const payload = {
        channelId: WOZTELL_CHANNEL_ID,
        recipientId: numeroDestino, // Se usa el número de teléfono
        redirect: {
            tree: treeId,
            nodeCompositeId: nodeId,
            runPreAction: true,
            sendResponse: false, // 💡 CLAVE: En 'false' para que el nodo no mande textos duplicados[cite: 7]
            runPostAction: true
        }
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.ok === 1) {
            console.log("✅ [WOZTELL] ¡Cliente redirigido con éxito al nuevo nodo!");
        } else {
            console.log("❌ [WOZTELL] Error al redirigir:", JSON.stringify(data));
        }
    } catch (error) {
        console.error("❌ [WOZTELL] Falla de conexión al redirigir:", error.message);
    }
}

module.exports = { enviarMensajeTexto, enviarImagen, activarLiveChat, enviarPlantillaMeta, redirigirANodo };