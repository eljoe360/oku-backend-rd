const express = require('express');
const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   CONFIGURACIÓN
========================================================= */

// Detrás de un proxy (Render, Railway, Nginx...) para que req.protocol sea correcto
app.set('trust proxy', 1);
app.disable('x-powered-by');

// URL pública de tu servicio, ej: https://mi-backend.onrender.com
// Si no se define, se deduce de la petición.
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

// Secreto para firmar las URLs del proxy. DEFÍNELO en producción.
let SECRET = process.env.PROXY_SECRET;
if (!SECRET) {
    SECRET = crypto.randomBytes(32).toString('hex');
    console.warn(
        '[AVISO] PROXY_SECRET no definido. Se generó uno temporal; ' +
        'las URLs firmadas dejarán de funcionar al reiniciar.'
    );
}

// Hosts (separados por coma) a los que se les permite certificado inválido.
// Ejemplo: INSECURE_TLS_HOSTS=live2.telemicro.com.do
const INSECURE_TLS_HOSTS = (process.env.INSECURE_TLS_HOSTS || '')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);

const agenteSeguro = new https.Agent({
    keepAlive: true,
    maxSockets: 100
});

const agenteInseguro = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    maxSockets: 50
});

function agenteParaUrl(urlStr) {
    try {
        const host = new URL(urlStr).hostname.toLowerCase();
        return INSECURE_TLS_HOSTS.includes(host) ? agenteInseguro : agenteSeguro;
    } catch {
        return agenteSeguro;
    }
}

const CANALES_JSON =
    process.env.CANALES_JSON ||
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/* CONFIGURACIÓN DE CANALES (se pueden sobreescribir con variables de entorno) */
const TELEMICRO_PLAYLIST =
    process.env.TELEMICRO_PLAYLIST ||
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

const CANAL6_STREAM_URL =
    process.env.CANAL6_STREAM_URL ||
    'https://stream.elseis.do/canal6/master.m3u8';

/* CANAL 7 - ANTENA 7 */
const CANAL7_STREAM_URL =
    process.env.CANAL7_STREAM_URL ||
    'https://d3gie3ig6argu.cloudfront.net/medialist_15609871089997455276_hls.m3u8';

/* CANAL 8 - TELEMEDIOS */
const CANAL8_VIDEO_ID = process.env.CANAL8_VIDEO_ID || 'x9hvyy0';

/* Mapa: bandera en el JSON -> ruta de esta API */
const CANALES_WEB = {
    telemicro_web: 'telemicro',
    canal6_web: 'canal6',
    canal7_web: 'canal7',
    canal8_web: 'canal8'
};

/* =========================================================
   MIDDLEWARE (CORS, límites)
========================================================= */
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// HLS hace muchas peticiones por segundo por espectador: límite generoso.
app.use(
    rateLimit({
        windowMs: 60 * 1000,
        max: 1200,
        standardHeaders: true,
        legacyHeaders: false
    })
);

/* =========================================================
   UTILIDADES
========================================================= */
function obtenerBaseUrl(req) {
    if (PUBLIC_URL) return PUBLIC_URL;
    return `${req.protocol}://${req.get('host')}`;
}

function firmar(url, ref = '') {
    return crypto
        .createHmac('sha256', SECRET)
        .update(`${url}\n${ref}`)
        .digest('hex');
}

function firmaValida(url, ref = '', sig = '') {
    const esperada = Buffer.from(firmar(url, ref));
    const recibida = Buffer.from(String(sig));
    return (
        esperada.length === recibida.length &&
        crypto.timingSafeEqual(esperada, recibida)
    );
}

function urlHttpValida(str) {
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Valida los parámetros firmados (url, ref, sig).
 * Devuelve { url, ref } o null (y ya responde con el error).
 */
function validarParametrosProxy(req, res) {
    const { url, ref = '', sig } = req.query;

    if (typeof url !== 'string' || !url) {
        res.status(400).send('Falta URL');
        return null;
    }
    if (typeof ref !== 'string') {
        res.status(400).send('Parámetro ref inválido');
        return null;
    }
    if (!urlHttpValida(url)) {
        res.status(400).send('URL inválida');
        return null;
    }
    if (!firmaValida(url, ref, sig)) {
        res.status(403).send('Firma inválida');
        return null;
    }
    return { url, ref };
}

/* =========================================================
   EXTRACTOR DE DAILYMOTION (con caché)
========================================================= */
const DM_CACHE_MS = 25 * 1000;
const dmCache = new Map(); // videoId -> { url, expira }
const dmEnCurso = new Map(); // videoId -> Promise (evita scrapes duplicados)

async function extraerStreamDailymotion(videoId) {
    // Método 1: API de Player Metadata
    try {
        const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
        const respuesta = await axios.get(metadataUrl, {
            httpsAgent: agenteSeguro,
            timeout: 6000,
            headers: {
                'User-Agent': USER_AGENT,
                Referer: `https://www.dailymotion.com/embed/video/${videoId}`
            }
        });

        if (respuesta.data?.qualities) {
            const qualities = respuesta.data.qualities;
            const autoList = qualities.auto || Object.values(qualities).flat();
            const videoStream = autoList.find(
                q => q.url && q.url.includes('.m3u8')
            );
            if (videoStream?.url) return videoStream.url;
        }
    } catch (e) {
        console.error(`[Dailymotion API] Error en ${videoId}:`, e.message);
    }

    // Método 2: Extracción de respaldo vía Embed
    try {
        const embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
        const res = await axios.get(embedUrl, {
            httpsAgent: agenteSeguro,
            timeout: 6000,
            headers: { 'User-Agent': USER_AGENT }
        });

        const match = String(res.data).match(
            /https%3A%2F%2F[^\s"']+\.m3u8[^\s"']*/
        );
        if (match) {
            return decodeURIComponent(match[0]);
        }
    } catch (e) {
        console.error(`[Dailymotion Scraping] Error en ${videoId}:`, e.message);
    }

    return null;
}

async function obtenerStreamDailymotionFresco(videoId) {
    const cache = dmCache.get(videoId);
    if (cache && cache.expira > Date.now()) {
        return cache.url;
    }

    if (dmEnCurso.has(videoId)) {
        return dmEnCurso.get(videoId);
    }

    const promesa = extraerStreamDailymotion(videoId)
        .then(url => {
            if (url) {
                dmCache.set(videoId, { url, expira: Date.now() + DM_CACHE_MS });
            }
            return url;
        })
        .finally(() => dmEnCurso.delete(videoId));

    dmEnCurso.set(videoId, promesa);
    return promesa;
}

/* =========================================================
   PROXY Y REESCRITOR HLS
========================================================= */
function crearUrlProxy(baseUrl, absoluta, ref) {
    const esPlaylist = new URL(absoluta).pathname
        .toLowerCase()
        .endsWith('.m3u8');
    const ruta = esPlaylist ? 'subplaylist' : 'segment';

    return (
        `${baseUrl}/api/proxy/${ruta}` +
        `?url=${encodeURIComponent(absoluta)}` +
        `&ref=${encodeURIComponent(ref)}` +
        `&sig=${firmar(absoluta, ref)}`
    );
}

function reescribirLinea(linea, streamUrl, baseUrl, ref) {
    const texto = linea.trim();
    if (!texto) return linea;

    // Etiquetas con URI="..." (claves, init de fMP4, audio/subtítulos...)
    if (texto.startsWith('#')) {
        return linea.replace(/URI="([^"]+)"/g, (_, uri) => {
            try {
                const abs = new URL(uri, streamUrl).href;
                return `URI="${crearUrlProxy(baseUrl, abs, ref)}"`;
            } catch {
                return `URI="${uri}"`;
            }
        });
    }

    // Línea de segmento o sub-playlist
    try {
        const abs = new URL(texto, streamUrl).href;
        return crearUrlProxy(baseUrl, abs, ref);
    } catch {
        return linea;
    }
}

async function procesarPlaylistProxy(streamUrl, req, res, referer = '') {
    try {
        const headers = { 'User-Agent': USER_AGENT };
        if (referer) headers.Referer = referer;

        const respuesta = await axios.get(streamUrl, {
            httpsAgent: agenteParaUrl(streamUrl),
            timeout: 12000,
            responseType: 'text',
            maxContentLength: 5 * 1024 * 1024, // 5 MB, de sobra para un m3u8
            headers
        });

        const baseUrl = obtenerBaseUrl(req);
        const lineas = String(respuesta.data).split(/\r?\n/);
        const nuevas = lineas.map(l =>
            reescribirLinea(l, streamUrl, baseUrl, referer)
        );

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevas.join('\n'));
    } catch (error) {
        const status = error.response?.status;
        console.error(
            `Error procesando playlist (${streamUrl}):`,
            status ? `HTTP ${status}` : error.message
        );
        res.status(502).send('Error en transmisión');
    }
}

app.get('/api/proxy/subplaylist', async (req, res) => {
    const params = validarParametrosProxy(req, res);
    if (!params) return;

    await procesarPlaylistProxy(params.url, req, res, params.ref);
});

app.get('/api/proxy/segment', async (req, res) => {
    const params = validarParametrosProxy(req, res);
    if (!params) return;

    const { url, ref } = params;
    const headers = { 'User-Agent': USER_AGENT };
    if (ref) headers.Referer = ref;

    try {
        const origen = await axios.get(url, {
            httpsAgent: agenteParaUrl(url),
            timeout: 20000,
            responseType: 'stream',
            maxContentLength: 50 * 1024 * 1024,
            validateStatus: s => s < 500,
            headers
        });

        // Si el cliente se desconecta, cerramos la conexión con el origen
        res.on('close', () => origen.data.destroy());

        if (origen.status >= 400) {
            origen.data.destroy();
            console.error(`Segmento rechazado (HTTP ${origen.status}): ${url}`);
            return res.status(origen.status).end();
        }

        res.status(origen.status);
        res.setHeader(
            'Content-Type',
            origen.headers['content-type'] || 'video/mp2t'
        );

        origen.data.on('error', err => {
            console.error('Error en stream de segmento:', err.message);
            res.destroy(err);
        });

        origen.data.pipe(res);
    } catch (error) {
        console.error(`Error de segmento (${url}):`, error.message);
        if (!res.headersSent) {
            res.status(502).send('Error de segmento');
        } else {
            res.destroy();
        }
    }
});

/* =========================================================
   1. ENDPOINT PRINCIPAL (con caché y respaldo)
========================================================= */
const CANALES_CACHE_MS = 45 * 1000;
let canalesCache = { data: null, expira: 0 };

async function obtenerCanales() {
    if (canalesCache.data && canalesCache.expira > Date.now()) {
        return canalesCache.data;
    }

    try {
        const respuesta = await axios.get(CANALES_JSON, {
            httpsAgent: agenteSeguro,
            timeout: 15000
        });

        if (!Array.isArray(respuesta.data)) {
            throw new Error('El JSON de canales no es un arreglo');
        }

        canalesCache = {
            data: respuesta.data,
            expira: Date.now() + CANALES_CACHE_MS
        };
        return canalesCache.data;
    } catch (error) {
        // Si falla GitHub, devolvemos la última copia buena (aunque esté vencida)
        if (canalesCache.data) {
            console.error(
                'GitHub falló, usando copia anterior:',
                error.message
            );
            return canalesCache.data;
        }
        throw error;
    }
}

app.get('/api/canales', async (req, res) => {
    try {
        const canales = await obtenerCanales();
        const baseUrl = obtenerBaseUrl(req);

        const resultado = canales.map(canal => {
            for (const [bandera, ruta] of Object.entries(CANALES_WEB)) {
                if (canal[bandera] === true) {
                    return { ...canal, url: `${baseUrl}/api/${ruta}` };
                }
            }
            return canal;
        });

        res.json(resultado);
    } catch (error) {
        console.error('Error obteniendo canales:', error.message);
        res.status(500).json({
            error: 'No se pudo obtener la lista de canales'
        });
    }
});

/* =========================================================
   2. CANAL 5 (TELEMICRO)
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
   3. CANAL 7 (ANTENA 7)
========================================================= */
app.get('/api/canal7', async (req, res) => {
    await procesarPlaylistProxy(CANAL7_STREAM_URL, req, res);
});

/* =========================================================
   4. CANAL 8 (TELEMEDIOS)
========================================================= */
app.get('/api/canal8', async (req, res) => {
    const streamUrl = await obtenerStreamDailymotionFresco(CANAL8_VIDEO_ID);

    if (!streamUrl) {
        return res.status(503).send('Sin señal Canal 8');
    }

    // Redirección directa para preservar tokens
    // de sesión dinámicos de Dailymotion
    res.redirect(302, streamUrl);
});

/* =========================================================
   5. CANAL 6
========================================================= */
app.get('/api/canal6', async (req, res) => {
    await procesarPlaylistProxy(CANAL6_STREAM_URL, req, res);
});

/* =========================================================
   INICIO DEL SERVIDOR
========================================================= */
app.get('/', (req, res) => {
    res.send('ROKU Backend RD funcionando correctamente');
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
