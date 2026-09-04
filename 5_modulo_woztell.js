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

module.exports = { enviarMensajeTexto, enviarImagen }; // No olvides exportarla

// 🟢 Exportamos SOLO el envío de texto
module.exports = { enviarMensajeTexto };