const express = require('express');
const axios = require('axios');
const https = require('https');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   CONFIGURACIÓN
========================================================= */
app.set('trust proxy', true);
app.disable('x-powered-by');

const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

let SECRET = process.env.PROXY_SECRET;
if (!SECRET) {
    SECRET = crypto.randomBytes(32).toString('hex');
    console.warn('[AVISO] PROXY_SECRET no definido. Se generó uno temporal.');
}

const INSECURE_TLS_HOSTS = (process.env.INSECURE_TLS_HOSTS || 'live2.telemicro.com.do')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);

const agenteSeguro = new https.Agent({ keepAlive: true, maxSockets: 100 });
const agenteInseguro = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 50 });

function agenteParaUrl(urlStr) {
    try {
        const host = new URL(urlStr).hostname.toLowerCase();
        return INSECURE_TLS_HOSTS.includes(host) ? agenteInseguro : agenteSeguro;
    } catch {
        return agenteSeguro;
    }
}

const CANALES_JSON = process.env.CANALES_JSON || 'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/* CONFIGURACIÓN DE CANALES */
const TELEMICRO_PLAYLIST = process.env.TELEMICRO_PLAYLIST || 'https://live2.telemicro.com.do/live/55/playlist.m3u8';
const CANAL6_STREAM_URL = process.env.CANAL6_STREAM_URL || 'https://stream.elseis.do/canal6/master.m3u8';

/* CANAL 9 - COLOR VISIÓN (DAILYMOTION) */
const CANAL9_VIDEO_ID = process.env.CANAL9_VIDEO_ID || 'x7gy059';

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

/* RATE LIMITER */
const LIMITE_VENTANA_MS = 60 * 1000;
const LIMITE_MAX = 1200;
const contadores = new Map();

app.use((req, res, next) => {
    const ahora = Date.now();
    let c = contadores.get(req.ip);

    if (!c || c.reinicio <= ahora) {
        c = { cuenta: 0, reinicio: ahora + LIMITE_VENTANA_MS };
        contadores.set(req.ip, c);
    }

    c.cuenta++;
    if (c.cuenta > LIMITE_MAX) {
        res.setHeader('Retry-After', Math.ceil((c.reinicio - ahora) / 1000));
        return res.status(429).send('Demasiadas peticiones');
    }
    next();
});

setInterval(() => {
    const ahora = Date.now();
    for (const [ip, c] of contadores) {
        if (c.reinicio <= ahora) contadores.delete(ip);
    }
}, LIMITE_VENTANA_MS).unref();

/* =========================================================
   UTILIDADES Y FIRMAS
========================================================= */
function obtenerBaseUrl(req) {
    if (PUBLIC_URL) return PUBLIC_URL;
    return `${req.protocol}://${req.get('host')}`;
}

function firmar(url, ref = '') {
    return crypto.createHmac('sha256', SECRET).update(`${url}\n${ref}`).digest('hex');
}

function firmaValida(url, ref = '', sig = '') {
    if (!sig) return false;
    const esperada = Buffer.from(firmar(url, ref));
    const recibida = Buffer.from(String(sig));
    return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

function urlHttpValida(str) {
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

function validarParametrosProxy(req, res) {
    const { url, ref = '', sig } = req.query;
    if (typeof url !== 'string' || !url) { res.status(400).send('Falta URL'); return null; }
    if (!urlHttpValida(url)) { res.status(400).send('URL inválida'); return null; }
    if (!firmaValida(url, ref, sig)) { res.status(403).send('Firma inválida'); return null; }
    return { url, ref };
}

/* =========================================================
   EXTRACTOR DINÁMICO DE DAILYMOTION (CANAL 9)
========================================================= */
const DM_CACHE_MS = 20 * 1000; // Caché corta para evitar URLs caducadas
const dmCache = new Map();

async function extraerStreamDailymotion(videoId) {
    const ahora = Date.now();
    const cached = dmCache.get(videoId);
    if (cached && cached.expira > ahora) return cached.url;

    try {
        const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
        const respuesta = await axios.get(metadataUrl, {
            httpsAgent: agenteSeguro,
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
            if (videoStream?.url) {
                dmCache.set(videoId, { url: videoStream.url, expira: ahora + DM_CACHE_MS });
                return videoStream.url;
            }
        }
    } catch (e) {
        console.error(`[Dailymotion Error] ${videoId}:`, e.message);
    }
    return null;
}

/* =========================================================
   PROCESADOR DE PLAYLISTS M3U8
========================================================= */
async function procesarPlaylistProxy(streamUrl, req, res, referer = '') {
    try {
        const headers = { 'User-Agent': USER_AGENT };
        if (referer) {
            headers['Referer'] = referer;
            headers['Origin'] = new URL(referer).origin;
        }

        const respuesta = await axios.get(streamUrl, {
            httpsAgent: agenteParaUrl(streamUrl),
            timeout: 10000,
            responseType: 'text',
            headers
        });

        const baseUrl = obtenerBaseUrl(req);
        const lineas = respuesta.data.split(/\r?\n/);

        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#')) {
                const urlAbsoluta = new URL(texto, streamUrl).href;
                const sig = firmar(urlAbsoluta, referer);
                const query = `url=${encodeURIComponent(urlAbsoluta)}&ref=${encodeURIComponent(referer)}&sig=${sig}`;

                if (texto.includes('.m3u8')) {
                    return `${baseUrl}/api/proxy/subplaylist?${query}`;
                }
                return `${baseUrl}/api/proxy/segment?${query}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));
    } catch (error) {
        console.error('[Error M3U8]:', error.message);
        res.status(500).send('Error procesando transmisión');
    }
}

/* =========================================================
   ENDPOINTS PROXY
========================================================= */
app.get('/api/proxy/subplaylist', async (req, res) => {
    const params = validarParametrosProxy(req, res);
    if (!params) return;
    await procesarPlaylistProxy(params.url, req, res, params.ref);
});

app.get('/api/proxy/segment', async (req, res) => {
    const params = validarParametrosProxy(req, res);
    if (!params) return;

    try {
        const headers = { 'User-Agent': USER_AGENT };
        if (params.ref) {
            headers['Referer'] = params.ref;
            headers['Origin'] = new URL(params.ref).origin;
        }

        const respuesta = await axios.get(params.url, {
            httpsAgent: agenteParaUrl(params.url),
            timeout: 15000,
            responseType: 'stream',
            headers
        });

        if (respuesta.headers['content-type']) {
            res.setHeader('Content-Type', respuesta.headers['content-type']);
        }
        respuesta.data.pipe(res);
    } catch (error) {
        res.status(500).send('Error de segmento');
    }
});

/* =========================================================
   RUTAS DE CANALES
========================================================= */
app.get('/api/canales', async (req, res) => {
    try {
        const respuesta = await axios.get(CANALES_JSON, { timeout: 10000 });
        const canales = respuesta.data;
        const baseUrl = obtenerBaseUrl(req);

        const resultado = canales.map(canal => {
            if (canal.telemicro_web) return { ...canal, url: `${baseUrl}/api/telemicro` };
            if (canal.canal6_web) return { ...canal, url: `${baseUrl}/api/canal6` };
            if (canal.canal9_web) return { ...canal, url: `${baseUrl}/api/canal9` };
            return canal;
        });

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: 'No se pudo obtener la lista de canales' });
    }
});

app.get('/api/telemicro', async (req, res) => {
    await procesarPlaylistProxy(TELEMICRO_PLAYLIST, req, res, 'https://telemicro.com.do/');
});

app.get('/api/canal6', async (req, res) => {
    await procesarPlaylistProxy(CANAL6_STREAM_URL, req, res);
});

app.get('/api/canal9', async (req, res) => {
    const streamUrl = await extraerStreamDailymotion(CANAL9_VIDEO_ID);
    if (!streamUrl) return res.status(503).send('Sin señal Canal 9');
    await procesarPlaylistProxy(streamUrl, req, res, 'https://www.dailymotion.com/');
});

app.get('/', (req, res) => res.send('ROKU Backend RD OK'));

app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
