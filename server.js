const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

const CANALES_JSON = 'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/* CONFIGURACIÓN DE CANALES */
const TELEMICRO_PLAYLIST = 'https://live2.telemicro.com.do/live/55/playlist.m3u8';
const CANAL6_STREAM_URL = 'https://stream.elseis.do/canal6/master.m3u8';

/* CANAL 7 - ANTENA 7 */
const CANAL7_STREAM_URL = 'https://d3gie3ig6argu.cloudfront.net/medialist_15609871089997455276_hls.m3u8';

/* CANAL 8 - TELEMEDIOS */
const CANAL8_VIDEO_ID = 'x9hvyy0';

function obtenerBaseUrl(req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protocol}://${host}`;
}

/* =========================================================
   EXTRACTOR ROBUSATO DE DAILYMOTION
========================================================= */
async function obtenerStreamDailymotionFresco(videoId) {
    // Método 1: API de Player Metadata
    try {
        const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
        const respuesta = await axios.get(metadataUrl, {
            httpsAgent,
            timeout: 6000,
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': `https://www.dailymotion.com/embed/video/${videoId}`
            }
        });

        if (respuesta.data?.qualities) {
            const qualities = respuesta.data.qualities;
            const autoList = qualities.auto || Object.values(qualities).flat();
            const videoStream = autoList.find(q => q.url && q.url.includes('.m3u8'));
            if (videoStream?.url) return videoStream.url;
        }
    } catch (e) {
        console.error(`[Dailymotion API] Error en ${videoId}:`, e.message);
    }

    // Método 2: Extracción CDN de respaldo vía Embed
    try {
        const embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
        const res = await axios.get(embedUrl, {
            httpsAgent,
            timeout: 6000,
            headers: { 'User-Agent': USER_AGENT }
        });

        const match = res.data.match(/https%3A%2F%2F[^\s"']+\.m3u8[^\s"']*/);
        if (match) {
            const decodedUrl = decodeURIComponent(match[0]);
            return decodedUrl;
        }
    } catch (e) {
        console.error(`[Dailymotion Scraping] Error en ${videoId}:`, e.message);
    }

    return null;
}

/* =========================================================
   PROXIES Y PROCESADORES HLS
========================================================= */
async function procesarPlaylistProxy(streamUrl, req, res, referer = '') {
    try {
        const headers = { 'User-Agent': USER_AGENT };

        if (referer) {
            headers['Referer'] = referer;
        }

        const respuesta = await axios.get(streamUrl, {
            httpsAgent,
            timeout: 12000,
            responseType: 'text',
            headers
        });

        const baseUrl = obtenerBaseUrl(req);
        const lineas = respuesta.data.split(/\r?\n/);

        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();

            if (texto && !texto.startsWith('#')) {
                const urlAbsoluta = new URL(texto, streamUrl).href;

                if (texto.includes('.m3u8')) {
                    return `${baseUrl}/api/proxy/subplaylist?url=${encodeURIComponent(urlAbsoluta)}&ref=${encodeURIComponent(referer)}`;
                }

                return `${baseUrl}/api/proxy/segment?url=${encodeURIComponent(urlAbsoluta)}&ref=${encodeURIComponent(referer)}`;
            }

            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error('Error procesando playlist proxy:', error.message);
        res.status(500).send('Error en transmisión');
    }
}

app.get('/api/proxy/subplaylist', async (req, res) => {
    const { url, ref } = req.query;

    if (!url) {
        return res.status(400).send('Falta URL');
    }

    await procesarPlaylistProxy(
        url,
        req,
        res,
        ref || ''
    );
});

app.get('/api/proxy/segment', async (req, res) => {
    try {
        const { url, ref } = req.query;

        if (!url) {
            return res.status(400).send('Falta URL de segmento');
        }

        const headers = {
            'User-Agent': USER_AGENT
        };

        if (ref) {
            headers['Referer'] = ref;
        }

        const respuesta = await axios.get(url, {
            httpsAgent,
            timeout: 20000,
            responseType: 'arraybuffer',
            headers
        });

        res.setHeader(
            'Content-Type',
            respuesta.headers['content-type'] || 'video/mp2t'
        );

        res.send(respuesta.data);

    } catch (error) {
        res.status(500).send('Error de segmento');
    }
});

/* =========================================================
   1. ENDPOINT PRINCIPAL
========================================================= */
app.get('/api/canales', async (req, res) => {
    try {
        const respuesta = await axios.get(CANALES_JSON, {
            timeout: 15000
        });

        const canales = respuesta.data;
        const baseUrl = obtenerBaseUrl(req);

        const resultado = canales.map(canal => {

            if (canal.telemicro_web === true) {
                return {
                    ...canal,
                    url: `${baseUrl}/api/telemicro`
                };
            }

            if (canal.canal6_web === true) {
                return {
                    ...canal,
                    url: `${baseUrl}/api/canal6`
                };
            }

            if (canal.canal7_web === true) {
                return {
                    ...canal,
                    url: `${baseUrl}/api/canal7`
                };
            }

            if (canal.canal8_web === true) {
                return {
                    ...canal,
                    url: `${baseUrl}/api/canal8`
                };
            }

            return canal;
        });

        res.json(resultado);

    } catch (error) {
        console.error(
            'Error obteniendo canales:',
            error.message
        );

        res.status(500).json({
            error: 'No se pudo obtener la lista de canales'
        });
    }
});

/* =========================================================
   2. CANAL 5 (TELEMICRO)
   NO TOCAR
========================================================= */
app.get('/api/telemicro', async (req, res) => {
    await procesarPlaylistProxy(
        TELEMICRO_PLAYLIST,
        req,
        res,
        'https://telemicro.com.do/'
    );
});

/* =========================================================
   3. CANAL 7
   CAMBIADO SOLAMENTE ESTE CANAL
========================================================= */
app.get('/api/canal7', async (req, res) => {
    await procesarPlaylistProxy(
        CANAL7_STREAM_URL,
        req,
        res
    );
});

/* =========================================================
   4. CANAL 8
   NO TOCAR
========================================================= */
app.get('/api/canal8', async (req, res) => {
    const streamUrl = await obtenerStreamDailymotionFresco(
        CANAL8_VIDEO_ID
    );

    if (!streamUrl) {
        return res.status(503).send('Sin señal Canal 8');
    }

    // Redirección directa para preservar tokens
    // de sesión dinámicos de Dailymotion
    res.redirect(302, streamUrl);
});

/* =========================================================
   5. CANAL 6
   NO TOCAR
========================================================= */
app.get('/api/canal6', async (req, res) => {
    await procesarPlaylistProxy(
        CANAL6_STREAM_URL,
        req,
        res
    );
});

/* =========================================================
   INICIO DEL SERVIDOR
========================================================= */
app.get('/', (req, res) => {
    res.send(
        'ROKU Backend RD funcionando correctamente'
    );
});

app.listen(PORT, () => {
    console.log(
        `Servidor escuchando en puerto ${PORT}`
    );
});
