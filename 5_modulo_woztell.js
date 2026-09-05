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
    if (!memberId) return console.log("⚠️ Faltó el memberId para activar Live Chat.");
    console.log(`\n👨‍💻 [WOZTELL] Activando Live Chat para el member ${memberId}...`);
    
    const url = `https://open.api.woztell.com/v3?accessToken=${WOZTELL_TOKEN}`;
    const query = `
    mutation ToggleLiveChat($input: toggleLiveChatInput!) {
        toggleLiveChat(input: $input) { ok err }
    }`;
    const variables = { input: { memberId: memberId, liveChat: true } };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        const data = await res.json();
        if (data.data?.toggleLiveChat?.ok === 1) {
            console.log("✅ [WOZTELL] ¡Live Chat activado exitosamente!");
        } else {
            console.log("❌ [WOZTELL] Error al activar Live Chat:", data);
        }
    } catch (error) {
        console.error("❌ [WOZTELL] Falla de conexión en Live Chat:", error.message);
    }
}

module.exports = { enviarMensajeTexto, enviarImagen, activarLiveChat };