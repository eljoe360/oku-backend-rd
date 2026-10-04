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

const INSECURE_TLS_HOSTS = (process.env.INSECURE_TLS_HOSTS || 'live2.telemicro.com.do,live4.telemicro.com.do,ss2.tvrdomi.com,edge.livestreaminggroup.info,2-fss-2.streamhoster.com,live.eu-north-1a.cf.dmcdn.net')
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
const SPORTS_M3U_URL = process.env.SPORTS_M3U_URL || 'https://iptv-org.github.io/iptv/categories/sports.m3u';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/* =========================================================
   FUENTES DIRECTAS Y DE RESPALDO
========================================================= */
const TELEMICRO_PLAYLIST = process.env.TELEMICRO_PLAYLIST || 'https://live2.telemicro.com.do/live/55/playlist.m3u8';
const CANAL6_STREAM_URL  = process.env.CANAL6_STREAM_URL  || 'https://stream.elseis.do/canal6/master.m3u8';
const CANAL7_STREAM_URL  = process.env.CANAL7_STREAM_URL  || 'https://hls.tvabierta.net/hls/007.m3u8';
const CANAL8_STREAM_URL  = process.env.CANAL8_STREAM_URL  || 'http://190.122.104.210:5080/LiveApp/streams/telemedios.m3u8';
const CANAL9_STREAM_URL  = process.env.CANAL9_STREAM_URL  || 'https://hls.tvabierta.net/hls/009.m3u8';
const CANAL10_STREAM_URL = process.env.CANAL10_STREAM_URL || 'https://hls.tvabierta.net/hls/010.m3u8';
const CANAL11_STREAM_URL = process.env.CANAL11_STREAM_URL || 'https://hls.tvabierta.net/hls/011.m3u8';
const CANAL12_STREAM_URL = process.env.CANAL12_STREAM_URL || 'https://hls.tvabierta.net/hls/012.m3u8';
const CANAL13_STREAM_URL = process.env.CANAL13_STREAM_URL || 'https://live2.telemicro.com.do/live/telecentrocast_1080p/chunks.m3u8';
const CANAL15_STREAM_URL = process.env.CANAL15_STREAM_URL || 'https://live4.telemicro.com.do/live/digital15cast_1080p/chunks.m3u8';
const CANAL18_STREAM_URL = process.env.CANAL18_STREAM_URL || 'https://ss2.tvrdomi.com:1936/ame47/ame47/playlist.m3u8';
const CANAL19_STREAM_URL = process.env.CANAL19_STREAM_URL || 'https://5790d294af2dc.streamlock.net/tvhdlive/tvhdlive/playlist.m3u8';
const CANAL21_STREAM_URL = process.env.CANAL21_STREAM_URL || 'https://hls.tvabierta.net/hls/021.m3u8';
const CANAL23_STREAM_URL = process.env.CANAL23_STREAM_URL || 'https://hls.tvabierta.net/hls/023.m3u8';
const CANAL27_STREAM_URL = process.env.CANAL27_STREAM_URL || 'https://2-fss-2.streamhoster.com/pl_138/206532-6829902-1/playlist.m3u8';
const CANAL27_CHUNK_URL  = process.env.CANAL27_CHUNK_URL  || 'https://2-fss-2.streamhoster.com/pl_138/206532-6829902-1/chunklist.m3u8';
const CANAL32_STREAM_URL = process.env.CANAL32_STREAM_URL || 'https://edge.livestreaminggroup.info/vtv32live/index.m3u8';
const CANAL36_STREAM_URL = process.env.CANAL36_STREAM_URL || 'https://live.eu-north-1a.cf.dmcdn.net/sec2(rsqusoFpjgHqCgkTyxVgaaLCqMP8JvutmGOlT9afuB1V5GYJByYGXKnEicXlBc3fZcuEW0fatAspQ1dSQBnw0KMgxji-kn93sKGTZqz8DGGjpKBn_aeDtcwMLCrd6Ro068p_PkVz3OH_eXaRykm3nAT-_TfBwxXA30slT__b4LZF-NIrP3F2VN7FOwjAp_5r)/dm/4/xar1qcu/live-aac-128.m3u8';
const CANAL37_STREAM_URL = process.env.CANAL37_STREAM_URL || 'https://dmxleo.dailymotion.com/cdn/manifest/video/x9lincs.m3u8?af=2%2C7%2C8%2C9&vv=1%2C2%2C3%2C4%2C5%2C6%2C7%2C8%2C11%2C12%2C13%2C14&mm=video%2Fmp4%2Cvideo%2Fwebm%2Caudio%2Fmp4%2Caudio%2Fmpeg%2Caudio%2Faac%2Caudio%2Fmpeg3%2Caudio%2Fmp3%2Caudio%2Fvnd.wave%2Caudio%2Fwav%2Caudio%2Fwave%2Caudio%2Fogg%2Caudio%2Fvorbis%2Cimage%2Fjpeg%2Cimage%2Fpng%2Cimage%2Fwebp%2Cimage%2Fsvg%2Bxml&cse=1k44efh3m06aad97948&rts=803277&rhv=1&cen=prod&cpi=x3jtcrw&cpt=player&rla=en&cpr=x1b7bk&rdm=704068a5-e47c-4a6a-a344-54664382be46&eb=https%3A%2F%2Fwww.televisiondominicanaenvivo.com%2F&ps=661x372&td=www.televisiondominicanaenvivo.com&reader_gdpr_flag=0&reader_gdpr_consent=&gdpr_binary_consent=opt-out&gdpr_comes_from_infopack=0&reader_us_privacy=1---&vl=10&ciid=1k44efh3m06aad97948_VMAP_0_0&cidx=0&sidx=0&vidIdx=0&omp=Dailymotion%2F1.0&omn=0&imal=1&3pcb=0&rap=1&apo=monetization&pos=1&pdm=regular&pbm=1';

/* IDENTIFICADORES DAILYMOTION */
const CANAL9_VIDEO_ID  = process.env.CANAL9_VIDEO_ID  || 'x7gy059';
const CANAL11_VIDEO_ID = process.env.CANAL11_VIDEO_ID || 'x80ac48';
const CANAL12_VIDEO_ID = process.env.CANAL12_VIDEO_ID || 'xaio352';
const CANAL23_VIDEO_ID = process.env.CANAL23_VIDEO_ID || 'x9imtbq';
const CANAL36_VIDEO_ID = process.env.CANAL36_VIDEO_ID || 'xar1qcu';
const CANAL37_VIDEO_ID = process.env.CANAL37_VIDEO_ID || 'x9lincs';

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
   UTILIDADES Y FIRMAS HMAC
========================================================= */
function obtenerBaseUrl(req) {
    if (PUBLIC_URL) return PUBLIC_URL;
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${proto}://${host}`;
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
   EXTRACTOR AUTOMÁTICO DE DAILYMOTION
========================================================= */
const DM_CACHE_MS = 10 * 1000;
const dmCache = new Map();

async function extraerStreamDailymotion(videoId) {
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

        const qualities = respuesta.data?.qualities;
        if (qualities) {
            const autoList = qualities.auto || Object.values(qualities).flat();
            const videoStream = autoList.find(q => q.url && q.url.includes('.m3u8'));
            
            if (videoStream?.url) {
                dmCache.set(cacheKey, { url: videoStream.url, expira: ahora + DM_CACHE_MS });
                return videoStream.url;
            }
        }
    } catch (e) {
        console.warn(`[Dailymotion API] Error para ID ${videoId}:${e.message}`);
    }

    try {
        const apiUrl = `https://api.dailymotion.com/video/${videoId}?fields=stream_hls_url`;
        const respuesta = await axios.get(apiUrl, {
            httpAgent: agenteHttp,
            httpsAgent: agenteSeguro,
            timeout: 5000,
            headers: { 'User-Agent': USER_AGENT }
        });

        if (respuesta.data?.stream_hls_url) {
            const streamUrl = respuesta.data.stream_hls_url;
            dmCache.set(cacheKey, { url: streamUrl, expira: ahora + DM_CACHE_MS });
            return streamUrl;
        }
    } catch (e) {
        console.error(`[Dailymotion REST Error] ID ${videoId}:`, e.message);
    }

    return null;
}

/* =========================================================
   PROCESADOR PROXY Y REESCRITOR DE MANIFIESTOS M3U8
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
            timeout: 8000,
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
        return true;
    } catch (error) {
        return false;
    }
}

/* =========================================================
   ENDPOINTS PROXY GENERALES
========================================================= */
app.get('/api/proxy/subplaylist', async (req, res) => {
    const params = validarParametrosProxy(req, res);
    if (!params) return;
    const exito = await procesarPlaylistProxy(params.url, req, res, params.ref);
    if (!exito) res.status(500).send('Error procesando transmisión');
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
            timeout: 10000,
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
   PARSER Y ENDPOINT DE CATÁLOGO DEPORTIVO M3U
========================================================= */
app.get('/api/deportes', async (req, res) => {
    try {
        const respuesta = await axios.get(SPORTS_M3U_URL, { timeout: 10000 });
        const lineas = respuesta.data.split(/\r?\n/);
        const canales = [];
        let canalActual = null;

        const baseUrl = obtenerBaseUrl(req);

        for (let i = 0; i < lineas.length; i++) {
            const linea = lineas[i].trim();
            if (linea.startsWith('#EXTINF:')) {
                const infoNombre = linea.split(',')[1] || 'Canal Deportivo';
                const logoMatch = linea.match(/tvg-logo="(.*?)"/);
                canalActual = {
                    nombre: infoNombre.trim(),
                    logo: logoMatch ? logoMatch[1] : ''
                };
            } else if (linea && !linea.startsWith('#') && canalActual) {
                const streamOriginal = linea;
                const sig = firmar(streamOriginal, '');
                const proxiedUrl = `${baseUrl}/api/proxy/subplaylist?url=${encodeURIComponent(streamOriginal)}&sig=${sig}`;

                canales.push({
                    nombre: canalActual.nombre,
                    logo: canalActual.logo,
                    url: proxiedUrl
                });
                canalActual = null;
            }
        }

        res.json(canales);
    } catch (error) {
        res.status(500).json({ error: 'No se pudo cargar la lista de deportes M3U' });
    }
});

/* =========================================================
   RUTAS DE LOS CANALES Y CATÁLOGOS
========================================================= */
async function obtenerListaCanalesProcesada(req) {
    const baseUrl = obtenerBaseUrl(req);
    try {
        const respuesta = await axios.get(CANALES_JSON, { timeout: 10000 });
        const canales = respuesta.data;

        return canales.map(canal => {
            let targetUrl = canal.url;

            const claveWeb = Object.keys(canal).find(k => k.endsWith('_web') && canal[k]);
            if (claveWeb) {
                const nombreApi = claveWeb.replace('_web', '');
                targetUrl = `${baseUrl}/api/${nombreApi}`;
            }

            if (!targetUrl && canal.numero) {
                const numeroFormateado = String(canal.numero).padStart(3, '0');
                targetUrl = `https://hls.tvabierta.net/hls/${numeroFormateado}.m3u8`;
            }

            return { ...canal, url: targetUrl };
        });
    } catch (error) {
        console.error("Error cargando channels.json:", error.message);
        return [];
    }
}

app.get('/api/canales', async (req, res) => {
    const lista = await obtenerListaCanalesProcesada(req);
    if (lista.length > 0) {
        res.json(lista);
    } else {
        res.status(500).json({ error: 'No se pudo obtener la lista de canales' });
    }
});

app.get('/', async (req, res) => {
    const lista = await obtenerListaCanalesProcesada(req);
    if (lista.length > 0) {
        res.json(lista);
    } else {
        res.send('ROKU Backend RD OK');
    }
});

/* =========================================================
   ENDPOINTS DE CANALES
========================================================= */

app.get('/api/telemicro', async (req, res) => {
    const exito = await procesarPlaylistProxy(TELEMICRO_PLAYLIST, req, res, 'https://telemicro.com.do/');
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal6', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL6_STREAM_URL, req, res);
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal7', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL7_STREAM_URL, req, res);
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal8', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL8_STREAM_URL, req, res);
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal9', async (req, res) => {
    const streamUrlDm = await extraerStreamDailymotion(CANAL9_VIDEO_ID);
    if (streamUrlDm && (await procesarPlaylistProxy(streamUrlDm, req, res, 'https://www.dailymotion.com/'))) return;
    if (await procesarPlaylistProxy(CANAL9_STREAM_URL, req, res)) return;
    res.status(503).send('Señal no disponible para Canal 9');
});

app.get('/api/canal10', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL10_STREAM_URL, req, res);
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal11', async (req, res) => {
    const streamUrlDm = await extraerStreamDailymotion(CANAL11_VIDEO_ID);
    if (streamUrlDm && (await procesarPlaylistProxy(streamUrlDm, req, res, 'https://www.dailymotion.com/'))) return;
    if (await procesarPlaylistProxy(CANAL11_STREAM_URL, req, res)) return;
    res.status(503).send('Señal no disponible para Canal 11');
});

app.get('/api/canal12', async (req, res) => {
    const streamUrlDm = await extraerStreamDailymotion(CANAL12_VIDEO_ID);
    if (streamUrlDm && (await procesarPlaylistProxy(streamUrlDm, req, res, 'https://www.dailymotion.com/'))) return;
    if (await procesarPlaylistProxy(CANAL12_STREAM_URL, req, res)) return;
    res.status(503).send('Señal no disponible para Canal 12');
});

app.get('/api/canal13', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL13_STREAM_URL, req, res, 'https://telemicro.com.do/');
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal15', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL15_STREAM_URL, req, res, 'https://telemicro.com.do/');
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal18', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL18_STREAM_URL, req, res);
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal19', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL19_STREAM_URL, req, res);
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal21', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL21_STREAM_URL, req, res);
    if (!exito) res.status(500).send('Error en la señal');
});

app.get('/api/canal23', async (req, res) => {
    const streamUrlDm = await extraerStreamDailymotion(CANAL23_VIDEO_ID);
    if (streamUrlDm && (await procesarPlaylistProxy(streamUrlDm, req, res, 'https://www.dailymotion.com/'))) return;
    if (await procesarPlaylistProxy(CANAL23_STREAM_URL, req, res)) return;
    res.status(503).send('Señal no disponible para Canal 23');
});

app.get('/api/canal27', async (req, res) => {
    if (await procesarPlaylistProxy(CANAL27_STREAM_URL, req, res)) return;
    if (await procesarPlaylistProxy(CANAL27_CHUNK_URL, req, res)) return;
    res.status(503).send('Error en la señal del Canal 27');
});

app.get('/api/canal32', async (req, res) => {
    const exito = await procesarPlaylistProxy(CANAL32_STREAM_URL, req, res);
    if (!exito) res.status(500).send('Error en la señal del Canal 32');
});

app.get('/api/canal36', async (req, res) => {
    const streamUrlDm = await extraerStreamDailymotion(CANAL36_VIDEO_ID);
    if (streamUrlDm && (await procesarPlaylistProxy(streamUrlDm, req, res, 'https://www.dailymotion.com/'))) return;
    if (await procesarPlaylistProxy(CANAL36_STREAM_URL, req, res, 'https://www.dailymotion.com/')) return;
    res.status(503).send('Señal no disponible para Canal 36');
});

app.get('/api/canal37', async (req, res) => {
    const streamUrlDm = await extraerStreamDailymotion(CANAL37_VIDEO_ID);
    if (streamUrlDm && (await procesarPlaylistProxy(streamUrlDm, req, res, 'https://www.televisiondominicanaenvivo.com/'))) return;
    if (await procesarPlaylistProxy(CANAL37_STREAM_URL, req, res, 'https://www.televisiondominicanaenvivo.com/')) return;
    res.status(503).send('Señal no disponible para Canal 37');
});

app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
