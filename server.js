const express = require('express');
const axios = require('axios');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   CONFIGURACIÓN Y MIDDLEWARES
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
const agenteHttp = new http.Agent({ keepAlive: true, maxSockets: 100 });

function agenteParaUrl(urlStr) {
    try {
        const u = new URL(urlStr);
        if (u.protocol === 'http:') return agenteHttp;
        return INSECURE_TLS_HOSTS.includes(u.hostname.toLowerCase()) ? agenteInseguro : agenteSeguro;
    } catch {
        return agenteSeguro;
    }
}

const CANALES_JSON = process.env.CANALES_JSON || 'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/* CONFIGURACIÓN DE URLS DE CANALES */
const TELEMICRO_PLAYLIST = process.env.TELEMICRO_PLAYLIST || 'https://live2.telemicro.com.do/live/55/playlist.m3u8';
const CANAL6_STREAM_URL = process.env.CANAL6_STREAM_URL || 'https://stream.elseis.do/canal6/master.m3u8';
const CANAL7_STREAM_URL = process.env.CANAL7_STREAM_URL || 'https://hls.tvabierta.net/hls/007.m3u8';
const CANAL8_STREAM_URL = process.env.CANAL8_STREAM_URL || 'http://190.122.104.210:5080/LiveApp/streams/telemedios.m3u8';

/* DAILYMOTION: CANAL 9 (COLOR VISIÓN) Y CANAL 11 (TELESISTEMA) */
const CANAL9_VIDEO_ID = process.env.CANAL9_VIDEO_ID || 'x7gy059';
const CANAL11_VIDEO_ID = process.env.CANAL11_VIDEO_ID || 'x80ac48';

const CANAL9_FALLBACK_URL = 'https://live.eu-north-1a.cf.dmcdn.net/sec2(KLqkM_kGjzvssE3oSBAg843Zt3GQcvNHH3se76sPlBHe00GQi686UcQlwa12qp-_wueAIi8_yN4NIIBUvESn5PQn6yUmxMs3f63VZ57dJYM3GHLghyK_7I75nZn13lcY)/dm/3/x7gy059/d/live-480.m3u8?startdate=2026-09-03T23%3A24%3A16%2B0000';
const CANAL11_FALLBACK_URL = 'https://live2.eu-north-1b.cf.dmcdn.net/sec2(BC2EhsEpta4dqDBBPYVP5vHPT2FerfUkqAyav3OyZKVjhliiI-jWH6YoRCYufyux0CbFw0zCUnEOaA8E1dS3F9arAGEOS0oIXRwZtMeOk2iEo-y-UtvmAgKzRdfjsRXK)/cloud/3/x80ac48/d/live-480.m3u8';

/* WINDTVO API (CANAL 13) */
const WINDTVO_API_URL = 'http://198.244.227.59:88/ttl_api_channel.php';

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
   EXTRACTOR WINDTVO (CANAL 13)
========================================================= */
async function obtenerStreamWindTVO(channelId) {
    try {
        const bodyData = new URLSearchParams({ channel_id: channelId }).toString();
        const respuesta = await axios.post(WINDTVO_API_URL, bodyData, {
            httpAgent: agenteHttp,
            timeout: 8000,
            headers: {
                'Host': 'lb.windtvo.do:88',
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (typeof respuesta.data === 'string' && respuesta.data.includes('.m3u8')) {
            return respuesta.data.trim();
        } else if (respuesta.data?.url) {
            return respuesta.data.url;
        }
    } catch (e) {
        console.error(`[WindTVO Error] Canal ${channelId}:`, e.message);
    }
    return null;
}

/* =========================================================
   EXTRACTOR MULTI-DAILYMOTION (CANAL 9 Y CANAL 11)
========================================================= */
const DM_CACHE_MS = 15 * 1000;
const dmCache = new Map();

async function extraerStreamDailymotion(videoId, fallbackUrl) {
    const ahora = Date.now();
    const cacheKey = `dm_${videoId}`;
    const cached = dmCache.get(cacheKey);
    if (cached && cached.expira > ahora) return cached.url;

    try {
        const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
        const respuesta = await axios.get(metadataUrl, {
            httpAgent: agenteHttp,
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
                dmCache.set(cacheKey, { url: videoStream.url, expira: ahora + DM_CACHE_MS });
                return videoStream.url;
            }
        }
    } catch (e) {
        console.error(`[Dailymotion Error] ${videoId}:`, e.message);
    }

    return fallbackUrl;
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
            httpAgent: agenteParaUrl(streamUrl),
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
            httpAgent: agenteParaUrl(params.url),
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
   RUTAS DE CANALES CON MAPEO ESTRICTO
========================================================= */
app.get('/api/canales', async (req, res) => {
    try {
        const respuesta = await axios.get(CANALES_JSON, { timeout: 10000 });
        const canales = respuesta.data;
        const baseUrl = obtenerBaseUrl(req);

        const resultado = canales.map(canal => {
            let targetUrl = canal.url;

            if (canal.telemicro_web) targetUrl = `${baseUrl}/api/telemicro`;
            else if (canal.canal6_web) targetUrl = `${baseUrl}/api/canal6`;
            else if (canal.canal7_web) targetUrl = `${baseUrl}/api/canal7`;
            else if (canal.canal8_web) targetUrl = `${baseUrl}/api/canal8`;
            else if (canal.canal9_web) targetUrl = `${baseUrl}/api/canal9`;
            else if (canal.canal11_web) targetUrl = `${baseUrl}/api/canal11`;
            else if (canal.canal13_web) targetUrl = `${baseUrl}/api/canal13`;

            return { ...canal, url: targetUrl };
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

app.get('/api/canal7', async (req, res) => {
    await procesarPlaylistProxy(CANAL7_STREAM_URL, req, res);
});

app.get('/api/canal8', async (req, res) => {
    await procesarPlaylistProxy(CANAL8_STREAM_URL, req, res);
});

/* CANAL 9 - COLOR VISIÓN */
app.get('/api/canal9', async (req, res) => {
    const streamUrl = await extraerStreamDailymotion(CANAL9_VIDEO_ID, CANAL9_FALLBACK_URL);
    if (!streamUrl) return res.status(503).send('Sin señal Canal 9');
    await procesarPlaylistProxy(streamUrl, req, res, 'https://www.dailymotion.com/');
});

/* CANAL 11 - TELESISTEMA (DAILYMOTION DINO) */
app.get('/api/canal11', async (req, res) => {
    const streamUrl = await extraerStreamDailymotion(CANAL11_VIDEO_ID, CANAL11_FALLBACK_URL);
    if (!streamUrl) return res.status(503).send('Sin señal Canal 11');
    await procesarPlaylistProxy(streamUrl, req, res, 'https://www.dailymotion.com/');
});

app.get('/api/canal13', async (req, res) => {
    const streamUrl = await obtenerStreamWindTVO('13');
    if (!streamUrl) return res.status(503).send('Sin señal Canal 13');
    await procesarPlaylistProxy(streamUrl, req, res, 'http://lb.windtvo.do:88/');
});

app.get('/', (req, res) => res.send('ROKU Backend RD OK'));

app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
