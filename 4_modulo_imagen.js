const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');
const path = require('path');

function getBase64Image(nombreArchivo) {
    try {
        const fullPath = path.join(__dirname, 'img', nombreArchivo);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️ [IMAGEN] No se encontró el archivo en: ${fullPath}`);
            return '';
        }

        const image = fs.readFileSync(fullPath);
        const extension = path.extname(nombreArchivo).toLowerCase();
        let mimeType = extension === '.png' ? 'image/png' : 'image/jpeg';

        return `data:${mimeType};base64,${image.toString('base64')}`;
    } catch (e) {
        console.error(`❌ [IMAGEN] Error leyendo ${nombreArchivo}:`, e.message);
        return ''; 
    }
}

async function generarImagenCotizacion(datosVehiculo, companias) {
    console.log("\n📸 [IMAGEN] Preparando el HTML y encendiendo la cámara...");

    try {
        const htmlTemplate = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800;900&display=swap" rel="stylesheet">
            <script src="https://unpkg.com/twemoji@latest/dist/twemoji.min.js" crossorigin="anonymous"></script>
            <style>
                :root { --primary: #008679; --mid: #2f6988; --secondary: #545393; --bg-page: #f4f7f9; --text-dark: #1e293b; --text-muted: #64748b; }
                * { box-sizing: border-box; }
                body { font-family: 'Nunito', sans-serif; background-color: transparent; display: inline-block; margin: 0; padding: 20px; }
                #captura { width: 950px; background-color: var(--bg-page); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
                
                img.emoji { width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; display: inline-block; }

                .header { background: linear-gradient(135deg, var(--primary) 0%, var(--mid) 50%, var(--secondary) 100%); color: white; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; }
                
                .brand-container { background-color: #f8f9fa; padding: 8px 18px; border-radius: 50px; display: inline-flex; align-items: center; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
                .brand-container img { max-height: 40px; max-width: 180px; object-fit: contain; }
                
                .header-left h2 { margin: 0; font-size: 24px; font-weight: 900; }
                .header-left p { margin: 6px 0 0 0; font-size: 15px; font-weight: 600; opacity: 0.9; }
                .header-right { background: rgba(255, 255, 255, 0.15); padding: 12px 20px; border-radius: 16px; text-align: right; }
                .header-right h3 { margin: 0; font-size: 18px; color: #fff; font-weight: 900; }
                .header-right p { margin: 4px 0 0 0; font-size: 13px; font-weight: 600; }
                
                .table-container { padding: 10px 30px 30px 30px; }
                table { width: 100%; border-collapse: separate; border-spacing: 0 16px; text-align: center; }
                th { color: var(--mid); font-size: 12px; padding: 10px 5px; text-transform: uppercase; font-weight: 900; }
                
                tbody tr { background-color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                tbody td { padding: 16px 8px; vertical-align: middle; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
                tbody td:first-child { border-left: 1px solid #e2e8f0; border-top-left-radius: 16px; border-bottom-left-radius: 16px; width: 20%; }
                tbody td:last-child { border-right: 1px solid #e2e8f0; border-top-right-radius: 16px; border-bottom-right-radius: 16px; }
                tbody td:nth-child(even) { background-color: rgba(47, 105, 136, 0.04); }
                
                .row-recommended { box-shadow: 0 10px 25px rgba(0, 134, 121, 0.15); }
                .row-recommended td { border-top: 2px solid var(--primary); border-bottom: 2px solid var(--primary); }
                .row-recommended td:first-child { border-left: 6px solid var(--primary); }
                .row-recommended td:last-child { border-right: 2px solid var(--primary); }

                .company-cell { position: relative; display: flex; flex-direction: column; align-items: center; padding-top: 12px; }
                
                .badge-dinamica { position: absolute; top: -24px; background: linear-gradient(135deg, var(--primary) 0%, var(--mid) 100%); color: white; font-size: 10px; font-weight: 900; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; display: flex; align-items: center; gap: 4px; }
                .badge-oferta { background: #e11d48; }
                
                .logo-box { height: 45px; display: flex; align-items: center; margin-bottom: 8px; }
                .logo-box img { max-width: 100px; max-height: 100%; object-fit: contain; }
                
                .suma-asegurada { background-color: #f1f5f9; color: var(--text-muted); font-size: 11px; padding: 4px 10px; border-radius: 8px; font-weight: 800; }
                .suma-gnc { background-color: #e0f2fe; color: #0284c7; font-size: 9.5px; padding: 4px 10px; border-radius: 8px; font-weight: 800; margin-top: 5px; box-shadow: inset 0 0 0 1px rgba(2, 132, 199, 0.2); }

                .price-tag { display: flex; flex-direction: column; align-items: center; gap: 3px; }
                .opt-num { background-color: rgba(47, 105, 136, 0.12); color: var(--mid); border-radius: 6px; font-size: 12px; font-weight: 900; padding: 2px 12px; }
                .price { font-weight: 900; color: var(--text-dark); font-size: 19px; }
                
                .desc { font-size: 8.5px; color: #64748b; font-weight: 800; text-transform: uppercase; max-width: 130px; line-height: 1.3; margin-top: 4px; text-align: center; word-wrap: break-word; }
                
                .empty { color: #cbd5e1; font-size: 20px; font-weight: 900; }
                .footer { text-align: center; padding: 20px; font-size: 14px; color: var(--text-muted); font-weight: 600; }
            </style>
        </head>
        <body onload="twemoji.parse(document.body)">
            <div id="captura">
                <div class="header">
                    <div class="header-left">
                        {{#if vehiculo.logoEmpresa}}
                        <div class="brand-container"><img src="{{{vehiculo.logoEmpresa}}}"></div>
                        {{/if}}
                        <h2>Cotización Vehicular</h2>
                        <p>Respondé con el número de la opción que prefieras</p>
                    </div>
                    <div class="header-right">
                        <h3>🚗 {{vehiculo.nombreCompleto}}</h3>
                        <p>Ref: #{{vehiculo.ticketId}}</p>
                    </div>
                </div>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th width="20%">COMPAÑÍA</th>
                                <th width="16%">RESPONSABILIDAD<br>CIVIL</th>
                                <th width="16%">TERCEROS<br>BÁSICOS</th>
                                <th width="16%">TERCEROS<br>COMPLETO FULL</th>
                                <th width="16%">TODO RIESGO<br>FRANQUICIA BAJA</th>
                                <th width="16%">TODO RIESGO<br>FRANQUICIA ALTA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {{#each companias}}
                            <tr {{#if this.etiqueta_html}}class="row-recommended"{{/if}}>
                                <td>
                                    <div class="company-cell">
                                        {{#if this.etiqueta_html}}
                                        <span class="badge-dinamica {{#if this.es_oferta}}badge-oferta{{/if}}">
                                            {{{this.etiqueta_html}}}
                                        </span>
                                        {{/if}}
                                        
                                        <div class="logo-box"><img src="{{this.logoBase64}}"></div>
                                        <div class="suma-asegurada">Asg: {{this.sumaAsg}}</div>
                                        {{#if this.sumaGnc}}
                                        <div class="suma-gnc">GNC: {{this.sumaGnc}}</div>
                                        {{/if}}
                                    </div>
                                </td>
                                
                                <td>{{#if this.rc}}<div class="price-tag"><span class="opt-num">{{this.opt_rc}}</span><span class="price">{{this.rc}}</span><div class="desc">{{this.desc_rc}}</div></div>{{else}}<span class="empty">-</span>{{/if}}</td>
                                <td>{{#if this.tb}}<div class="price-tag"><span class="opt-num">{{this.opt_tb}}</span><span class="price">{{this.tb}}</span><div class="desc">{{this.desc_tb}}</div></div>{{else}}<span class="empty">-</span>{{/if}}</td>
                                <td>{{#if this.tc}}<div class="price-tag"><span class="opt-num">{{this.opt_tc}}</span><span class="price">{{this.tc}}</span><div class="desc">{{this.desc_tc}}</div></div>{{else}}<span class="empty">-</span>{{/if}}</td>
                                <td>{{#if this.tr_baja}}<div class="price-tag"><span class="opt-num">{{this.opt_tr_baja}}</span><span class="price">{{this.tr_baja}}</span><div class="desc">{{this.desc_tr_baja}}</div></div>{{else}}<span class="empty">-</span>{{/if}}</td>
                                <td>{{#if this.tr_alta}}<div class="price-tag"><span class="opt-num">{{this.opt_tr_alta}}</span><span class="price">{{this.tr_alta}}</span><div class="desc">{{this.desc_tr_alta}}</div></div>{{else}}<span class="empty">-</span>{{/if}}</td>
                            </tr>
                            {{/each}}
                        </tbody>
                    </table>
                </div>
                
                <div class="footer">
                    {{{vehiculo.footerDinamico}}}
                </div>
            </div>
        </body>
        </html>
        `;

        const bufferImagen = await nodeHtmlToImage({
            html: htmlTemplate,
            content: { vehiculo: datosVehiculo, companias: companias },
            transparent: true,
            waitUntil: 'networkidle0', 
            puppeteerArgs: { args: ['--no-sandbox', '--disable-setuid-sandbox'] } 
        });
        
        console.log("✅ [IMAGEN] ¡Foto tomada! Imagen generada con éxito.");
        return bufferImagen;

    } catch (error) {
        console.error("❌ [IMAGEN] Error generando la imagen:", error);
        return null;
    }
}

module.exports = { getBase64Image, generarImagenCotizacion };