const moduloWoztell = require('./5_modulo_woztell');

const numeroPrueba = "5491169799220"; // Tu número

console.log("🚀 Iniciando prueba de TEXTO BÁSICO a Woztell...");

moduloWoztell.enviarMensajeTexto(numeroPrueba, "Hola, estoy probando desde Node.js 🤖")
    .then(() => console.log("🏁 Prueba finalizada. Revisá tu WhatsApp."));