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

const INSECURE_TLS_HOSTS = (
    process.env.INSECURE_TLS_HOSTS ||
    'live2.telemicro.com.do,live4.telemicro.com.do,ss2.tvrdomi.com,edge.livestreaminggroup.info,2-fss-2.streamhoster.com,live.eu-north-1a.cf.dmcdn.net'
)
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

const agenteHttp = new http.Agent({
    keepAlive: true,
    maxSockets: 100
});

function agenteParaUrl(urlStr) {
    try {
        const u = new URL(urlStr);

        if (u.protocol === 'http:') {
            return agenteHttp;
        }

        return INSECURE_TLS_HOSTS.includes(u.hostname.toLowerCase())
            ? agenteInseguro
            : agenteSeguro;

    } catch {
        return agenteSeguro;
    }
}

const CANALES_JSON =
    process.env.CANALES_JSON ||
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

const SPORTS_M3U_URL =
    process.env.SPORTS_M3U_URL ||
    'https://iptv-org.github.io/iptv/categories/sports.m3u';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';


/* =========================================================
   FUENTES DIRECTAS
========================================================= */

const TELEMICRO_PLAYLIST =
    process.env.TELEMICRO_PLAYLIST ||
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

const CANAL6_STREAM_URL =
    process.env.CANAL6_STREAM_URL ||
    'https://stream.elseis.do/canal6/master.m3u8';

const CANAL7_STREAM_URL =
    process.env.CANAL7_STREAM_URL ||
    'https://hls.tvabierta.net/hls/007.m3u8';

const CANAL8_STREAM_URL =
    process.env.CANAL8_STREAM_URL ||
    'http://190.122.104.210:5080/LiveApp/streams/telemedios.m3u8';

const CANAL9_STREAM_URL =
    process.env.CANAL9_STREAM_URL ||
    'https://hls.tvabierta.net/hls/009.m3u8';

const CANAL10_STREAM_URL =
    process.env.CANAL10_STREAM_URL ||
    'https://hls.tvabierta.net/hls/010.m3u8';

const CANAL11_STREAM_URL =
    process.env.CANAL11_STREAM_URL ||
    'https://hls.tvabierta.net/hls/011.m3u8';

const CANAL12_STREAM_URL =
    process.env.CANAL12_STREAM_URL ||
    'https://hls.tvabierta.net/hls/012.m3u8';

const CANAL13_STREAM_URL =
    process.env.CANAL13_STREAM_URL ||
    'https://live2.telemicro.com.do/live/telecentrocast_1080p/chunks.m3u8';

const CANAL15_STREAM_URL =
    process.env.CANAL15_STREAM_URL ||
    'https://live4.telemicro.com.do/live/digital15cast_1080p/chunks.m3u8';

const CANAL18_STREAM_URL =
    process.env.CANAL18_STREAM_URL ||
    'https://ss2.tvrdomi.com:1936/ame47/ame47/playlist.m3u8';

const CANAL19_STREAM_URL =
    process.env.CANAL19_STREAM_URL ||
    'https://5790d294af2dc.streamlock.net/tvhdlive/tvhdlive/playlist.m3u8';

const CANAL21_STREAM_URL =
    process.env.CANAL21_STREAM_URL ||
    'https://hls.tvabierta.net/hls/021.m3u8';

const CANAL23_STREAM_URL =
    process.env.CANAL23_STREAM_URL ||
    'https://hls.tvabierta.net/hls/023.m3u8';

const CANAL27_STREAM_URL =
    process.env.CANAL27_STREAM_URL ||
    'https://2-fss-2.streamhoster.com/pl_138/206532-6829902-1/playlist.m3u8';

const CANAL27_CHUNK_URL =
    process.env.CANAL27_CHUNK_URL ||
    'https://2-fss-2.streamhoster.com/pl_138/206532-6829902-1/chunklist.m3u8';

const CANAL32_STREAM_URL =
    process.env.CANAL32_STREAM_URL ||
    'https://edge.livestreaminggroup.info/vtv32live/index.m3u8';


/* =========================================================
   CANAL 36
   DAILYMOTION DINÁMICO
========================================================= */

/*
   IMPORTANTE:
   NO se guarda aquí ningún enlace sec2(...)
   porque esos enlaces son temporales.

   El servidor utilizará únicamente el ID de Dailymotion
   para intentar obtener una URL nueva.
*/

const CANAL36_VIDEO_ID =
    process.env.CANAL36_VIDEO_ID || 'xar1qcu';


/* =========================================================
   CANAL 37
   DAILYMOTION
========================================================= */

const CANAL37_STREAM_URL =
    process.env.CANAL37_STREAM_URL ||
    'https://dmxleo.dailymotion.com/cdn/manifest/video/x9lincs.m3u8';


/* =========================================================
   IDENTIFICADORES DAILYMOTION
========================================================= */

const CANAL9_VIDEO_ID =
    process.env.CANAL9_VIDEO_ID || 'x7gy059';

const CANAL11_VIDEO_ID =
    process.env.CANAL11_VIDEO_ID || 'x80ac48';

const CANAL12_VIDEO_ID =
    process.env.CANAL12_VIDEO_ID || 'xaio352';

const CANAL23_VIDEO_ID =
    process.env.CANAL23_VIDEO_ID || 'x9imtbq';

const CANAL37_VIDEO_ID =
    process.env.CANAL37_VIDEO_ID || 'x9lincs';


/* =========================================================
   CORS
========================================================= */

app.use((req, res, next) => {

    res.header('Access-Control-Allow-Origin', '*');

    res.header(
        'Access-Control-Allow-Headers',
        '*'
    );

    res.header(
        'Access-Control-Allow-Methods',
        'GET, HEAD, OPTIONS'
    );

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});


/* =========================================================
   RATE LIMITER
========================================================= */

const LIMITE_VENTANA_MS = 60 * 1000;
const LIMITE_MAX = 1200;

const contadores = new Map();

app.use((req, res, next) => {

    const ahora = Date.now();

    let c = contadores.get(req.ip);

    if (!c || c.reinicio <= ahora) {

        c = {
            cuenta: 0,
            reinicio: ahora + LIMITE_VENTANA_MS
        };

        contadores.set(req.ip, c);
    }

    c.cuenta++;

    if (c.cuenta > LIMITE_MAX) {

        res.setHeader(
            'Retry-After',
            Math.ceil((c.reinicio - ahora) / 1000)
        );

        return res
            .status(429)
            .send('Demasiadas peticiones');
    }

    next();
});


setInterval(() => {

    const ahora = Date.now();

    for (const [ip, c] of contadores) {

        if (c.reinicio <= ahora) {
            contadores.delete(ip);
        }
    }

}, LIMITE_VENTANA_MS).unref();


/* =========================================================
   UTILIDADES Y FIRMAS HMAC
========================================================= */

function obtenerBaseUrl(req) {

    if (PUBLIC_URL) {
        return PUBLIC_URL;
    }

    const proto =
        req.headers['x-forwarded-proto'] ||
        req.protocol;

    const host =
        req.headers['x-forwarded-host'] ||
        req.get('host');

    return `${proto}://${host}`;
}


function firmar(url, ref = '') {

    return crypto
        .createHmac('sha256', SECRET)
        .update(`${url}\n${ref}`)
        .digest('hex');
}


function firmaValida(url, ref = '', sig = '') {

    if (!sig) {
        return false;
    }

    const esperada =
        Buffer.from(firmar(url, ref));

    const recibida =
        Buffer.from(String(sig));

    return (
        esperada.length === recibida.length &&
        crypto.timingSafeEqual(
            esperada,
            recibida
        )
    );
}


function urlHttpValida(str) {

    try {

        const u = new URL(str);

        return (
            u.protocol === 'http:' ||
            u.protocol === 'https:'
        );

    } catch {

        return false;
    }
}


function validarParametrosProxy(req, res) {

    const {
        url,
        ref = '',
        sig
    } = req.query;

    if (
        typeof url !== 'string' ||
        !url
    ) {

        res.status(400).send('Falta URL');

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

    return {
        url,
        ref
    };
}


/* =========================================================
   EXTRACTOR DAILYMOTION
========================================================= */

/*
   30 segundos de caché.

   La URL de Dailymotion sigue siendo temporal,
   pero no necesitamos solicitar una nueva URL
   para absolutamente cada petición.
*/

const DM_CACHE_MS = 30 * 1000;

const dmCache = new Map();


function guardarDailymotionCache(
    videoId,
    url
) {

    if (!url) {
        return;
    }

    dmCache.set(
        `dm_${videoId}`,
        {
            url,
            expira:
                Date.now() +
                DM_CACHE_MS
        }
    );
}


function obtenerDailymotionCache(
    videoId
) {

    const cacheKey =
        `dm_${videoId}`;

    const cached =
        dmCache.get(cacheKey);

    if (
        cached &&
        cached.expira > Date.now()
    ) {

        return cached.url;
    }

    if (cached) {
        dmCache.delete(cacheKey);
    }

    return null;
}


function esM3U8(url) {

    if (
        typeof url !== 'string' ||
        !url
    ) {
        return false;
    }

    return (
        url.includes('.m3u8') ||
        url.includes('/manifest/')
    );
}


async function comprobarM3U8(
    streamUrl,
    videoId
) {

    if (!esM3U8(streamUrl)) {

        return false;
    }

    try {

        const respuesta =
            await axios.get(
                streamUrl,
                {
                    httpAgent:
                        agenteParaUrl(
                            streamUrl
                        ),

                    httpsAgent:
                        agenteParaUrl(
                            streamUrl
                        ),

                    timeout: 7000,

                    responseType: 'text',

                    headers: {
                        'User-Agent':
                            USER_AGENT,

                        'Referer':
                            `https://www.dailymotion.com/video/${videoId}`
                    },

                    validateStatus:
                        status =>
                            status >= 200 &&
                            status < 400
                }
            );


        const contenido =
            String(
                respuesta.data || ''
            );


        if (
            contenido.includes(
                '#EXTM3U'
            )
        ) {

            return true;
        }


        console.warn(
            `[Dailymotion] ${videoId} respondió sin #EXTM3U`
        );

        return false;

    } catch (e) {

        console.warn(
            `[Dailymotion] No se pudo verificar M3U8 ${videoId}:`,
            e.message
        );

        return false;
    }
}


async function extraerStreamDailymotion(
    videoId
) {

    /*
       ---------------------------------------------------------
       1. CACHE
       ---------------------------------------------------------
    */

    const cacheUrl =
        obtenerDailymotionCache(
            videoId
        );


    if (cacheUrl) {

        console.log(
            `[Dailymotion] ${videoId} usando URL en caché`
        );

        return cacheUrl;
    }


    /*
       ---------------------------------------------------------
       2. PLAYER METADATA
       ---------------------------------------------------------
    */

    try {

        const metadataUrl =
            `https://www.dailymotion.com/player/metadata/video/${videoId}`;


        const respuesta =
            await axios.get(
                metadataUrl,
                {
                    httpAgent:
                        agenteHttp,

                    httpsAgent:
                        agenteSeguro,

                    timeout: 8000,

                    headers: {
                        'User-Agent':
                            USER_AGENT,

                        'Referer':
                            `https://www.dailymotion.com/embed/video/${videoId}`
                    }
                }
            );


        const qualities =
            respuesta.data?.qualities;


        if (qualities) {

            let candidatos = [];


            if (
                Array.isArray(
                    qualities.auto
                )
            ) {

                candidatos =
                    qualities.auto;

            } else {

                candidatos =
                    Object.values(
                        qualities
                    )
                        .flat()
                        .filter(Boolean);
            }


            /*
               Primero buscamos HLS 480p.
            */

            const hls480 =
                candidatos.find(
                    q =>
                        q?.url &&
                        q.url.includes(
                            '.m3u8'
                        ) &&
                        (
                            String(
                                q.type || ''
                            ).includes('480') ||
                            String(
                                q.url
                            ).includes('480')
                        )
                );


            /*
               Después cualquier HLS.
            */

            const candidatosHLS =
                candidatos.filter(
                    q =>
                        q?.url &&
                        q.url.includes(
                            '.m3u8'
                        )
                );


            const posibles = [];


            if (hls480?.url) {
                posibles.push(
                    hls480.url
                );
            }


            for (
                const candidato
                of candidatosHLS
            ) {

                if (
                    candidato.url &&
                    !posibles.includes(
                        candidato.url
                    )
                ) {

                    posibles.push(
                        candidato.url
                    );
                }
            }


            for (
                const streamUrl
                of posibles
            ) {

                if (
                    await comprobarM3U8(
                        streamUrl,
                        videoId
                    )
                ) {

                    guardarDailymotionCache(
                        videoId,
                        streamUrl
                    );

                    console.log(
                        `[Dailymotion] ${videoId} -> HLS obtenido por metadata`
                    );

                    return streamUrl;
                }
            }
        }

    } catch (e) {

        console.warn(
            `[Dailymotion] Metadata falló para ${videoId}:`,
            e.message
        );
    }


    /*
       ---------------------------------------------------------
       3. API DAILYMOTION
       ---------------------------------------------------------
    */

    try {

        /*
           Para Live intentamos primero
           stream_live_hls_url.
        */

        const apiLiveUrl =
            `https://api.dailymotion.com/video/${videoId}?fields=stream_live_hls_url`;


        const respuestaLive =
            await axios.get(
                apiLiveUrl,
                {
                    httpAgent:
                        agenteHttp,

                    httpsAgent:
                        agenteSeguro,

                    timeout: 7000,

                    headers: {
                        'User-Agent':
                            USER_AGENT
                    }
                }
            );


        const liveUrl =
            respuestaLive.data
                ?.stream_live_hls_url;


        if (liveUrl) {

            if (
                await comprobarM3U8(
                    liveUrl,
                    videoId
                )
            ) {

                guardarDailymotionCache(
                    videoId,
                    liveUrl
                );

                console.log(
                    `[Dailymotion API] ${videoId} -> stream_live_hls_url`
                );

                return liveUrl;
            }
        }

    } catch (e) {

        console.warn(
            `[Dailymotion API] stream_live_hls_url falló para ${videoId}:`,
            e.message
        );
    }


    /*
       ---------------------------------------------------------
       4. API NORMAL HLS
       ---------------------------------------------------------
    */

    try {

        const apiUrl =
            `https://api.dailymotion.com/video/${videoId}?fields=stream_hls_url`;


        const respuesta =
            await axios.get(
                apiUrl,
                {
                    httpAgent:
                        agenteHttp,

                    httpsAgent:
                        agenteSeguro,

                    timeout: 7000,

                    headers: {
                        'User-Agent':
                            USER_AGENT
                    }
                }
            );


        const streamUrl =
            respuesta.data?.stream_hls_url;


        if (streamUrl) {

            if (
                await comprobarM3U8(
                    streamUrl,
                    videoId
                )
            ) {

                guardarDailymotionCache(
                    videoId,
                    streamUrl
                );

                console.log(
                    `[Dailymotion API] ${videoId} -> stream_hls_url`
                );

                return streamUrl;
            }
        }

    } catch (e) {

        console.warn(
            `[Dailymotion API] stream_hls_url falló para ${videoId}:`,
            e.message
        );
    }


    /*
       ---------------------------------------------------------
       NO ENCONTRADO
       ---------------------------------------------------------
    */

    console.warn(
        `[Dailymotion] No se encontró HLS válido para ${videoId}`
    );

    return null;
}


/* =========================================================
   PROCESADOR PROXY Y REESCRITOR M3U8
========================================================= */

async function procesarPlaylistProxy(
    streamUrl,
    req,
    res,
    referer = ''
) {

    try {

        if (
            !streamUrl ||
            !urlHttpValida(streamUrl)
        ) {

            console.error(
                '[Proxy] URL inválida:',
                streamUrl
            );

            return false;
        }


        const headers = {
            'User-Agent': USER_AGENT
        };


        if (referer) {

            headers['Referer'] =
                referer;

            try {

                headers['Origin'] =
                    new URL(
                        referer
                    ).origin;

            } catch {
                // No hacemos nada.
            }
        }


        const respuesta =
            await axios.get(
                streamUrl,
                {
                    httpAgent:
                        agenteParaUrl(
                            streamUrl
                        ),

                    httpsAgent:
                        agenteParaUrl(
                            streamUrl
                        ),

                    timeout: 10000,

                    responseType: 'text',

                    headers,

                    validateStatus:
                        status =>
                            status >= 200 &&
                            status < 400
                }
            );


        const contenido =
            String(
                respuesta.data || ''
            );


        /*
           Verificación importante:
           una playlist HLS válida debe comenzar
           o contener #EXTM3U.
        */

        if (
            !contenido.includes(
                '#EXTM3U'
            )
        ) {

            console.warn(
                `[Proxy] ${streamUrl} no devolvió un M3U8 válido.`
            );

            return false;
        }


        const baseUrl =
            obtenerBaseUrl(req);


        const lineas =
            contenido.split(/\r?\n/);


        const nuevasLineas =
            lineas.map(
                linea => {

                    const texto =
                        linea.trim();


                    if (
                        texto &&
                        !texto.startsWith('#')
                    ) {

                        let urlAbsoluta;


                        try {

                            urlAbsoluta =
                                new URL(
                                    texto,
                                    streamUrl
                                ).href;

                        } catch {

                            return linea;
                        }


                        const sig =
                            firmar(
                                urlAbsoluta,
                                referer
                            );


                        const query =
                            `url=${encodeURIComponent(urlAbsoluta)}` +
                            `&ref=${encodeURIComponent(referer)}` +
                            `&sig=${sig}`;


                        /*
                           Si es otra playlist M3U8,
                           enviamos a subplaylist.
                        */

                        if (
                            texto.includes(
                                '.m3u8'
                            )
                        ) {

                            return (
                                `${baseUrl}/api/proxy/subplaylist?${query}`
                            );
                        }


                        /*
                           Segmentos TS/AAC/etc.
                        */

                        return (
                            `${baseUrl}/api/proxy/segment?${query}`
                        );
                    }


                    return linea;
                }
            );


        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );


        res.send(
            nuevasLineas.join('\n')
        );


        return true;

    } catch (error) {

        console.error(
            `[Proxy Error] Falló playlist ${streamUrl}:`,
            error.message
        );

        return false;
    }
}


/* =========================================================
   ENDPOINT PROXY SUBPLAYLIST
========================================================= */

app.get(
    '/api/proxy/subplaylist',
    async (req, res) => {

        const params =
            validarParametrosProxy(
                req,
                res
            );


        if (!params) {
            return;
        }


        const exito =
            await procesarPlaylistProxy(
                params.url,
                req,
                res,
                params.ref
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error procesando transmisión'
                );
        }
    }
);


/* =========================================================
   ENDPOINT PROXY SEGMENTOS
========================================================= */

app.get(
    '/api/proxy/segment',
    async (req, res) => {

        const params =
            validarParametrosProxy(
                req,
                res
            );


        if (!params) {
            return;
        }


        try {

            const headers = {
                'User-Agent': USER_AGENT
            };


            if (params.ref) {

                headers['Referer'] =
                    params.ref;


                try {

                    headers['Origin'] =
                        new URL(
                            params.ref
                        ).origin;

                } catch {
                    // No hacemos nada.
                }
            }


            const respuesta =
                await axios.get(
                    params.url,
                    {
                        httpAgent:
                            agenteParaUrl(
                                params.url
                            ),

                        httpsAgent:
                            agenteParaUrl(
                                params.url
                            ),

                        timeout: 10000,

                        responseType: 'stream',

                        headers
                    }
                );


            if (
                respuesta.headers[
                    'content-type'
                ]
            ) {

                res.setHeader(
                    'Content-Type',
                    respuesta.headers[
                        'content-type'
                    ]
                );
            }


            respuesta.data.pipe(res);

        } catch (error) {

            console.error(
                '[Proxy] Error de segmento:',
                error.message
            );

            res
                .status(500)
                .send(
                    'Error de segmento'
                );
        }
    }
);


/* =========================================================
   PARSER DEPORTES M3U
========================================================= */

app.get(
    '/api/deportes',
    async (req, res) => {

        try {

            const respuesta =
                await axios.get(
                    SPORTS_M3U_URL,
                    {
                        timeout: 10000
                    }
                );


            const lineas =
                respuesta.data.split(
                    /\r?\n/
                );


            const canales = [];

            let canalActual = null;


            const baseUrl =
                obtenerBaseUrl(req);


            for (
                let i = 0;
                i < lineas.length;
                i++
            ) {

                const linea =
                    lineas[i].trim();


                if (
                    linea.startsWith(
                        '#EXTINF:'
                    )
                ) {

                    const infoNombre =
                        linea.split(',')[1] ||
                        'Canal Deportivo';


                    const logoMatch =
                        linea.match(
                            /tvg-logo="(.*?)"/
                        );


                    canalActual = {

                        nombre:
                            infoNombre.trim(),

                        logo:
                            logoMatch
                                ? logoMatch[1]
                                : ''
                    };

                } else if (
                    linea &&
                    !linea.startsWith('#') &&
                    canalActual
                ) {

                    const streamOriginal =
                        linea;


                    const sig =
                        firmar(
                            streamOriginal,
                            ''
                        );


                    const proxiedUrl =
                        `${baseUrl}/api/proxy/subplaylist?url=${encodeURIComponent(streamOriginal)}&sig=${sig}`;


                    canales.push({

                        nombre:
                            canalActual.nombre,

                        logo:
                            canalActual.logo,

                        url:
                            proxiedUrl
                    });


                    canalActual = null;
                }
            }


            res.json(canales);

        } catch (error) {

            console.error(
                '[Deportes] Error:',
                error.message
            );

            res
                .status(500)
                .json({
                    error:
                        'No se pudo cargar la lista de deportes M3U'
                });
        }
    }
);


/* =========================================================
   CATÁLOGO DE CANALES
========================================================= */

async function obtenerListaCanalesProcesada(
    req
) {

    const baseUrl =
        obtenerBaseUrl(req);


    try {

        const respuesta =
            await axios.get(
                CANALES_JSON,
                {
                    timeout: 10000
                }
            );


        const canales =
            respuesta.data;


        return canales.map(
            canal => {

                let targetUrl =
                    canal.url;


                const claveWeb =
                    Object.keys(canal)
                        .find(
                            k =>
                                k.endsWith(
                                    '_web'
                                ) &&
                                canal[k]
                        );


                if (claveWeb) {

                    const nombreApi =
                        claveWeb.replace(
                            '_web',
                            ''
                        );


                    targetUrl =
                        `${baseUrl}/api/${nombreApi}`;
                }


                if (
                    !targetUrl &&
                    canal.numero
                ) {

                    const numeroFormateado =
                        String(
                            canal.numero
                        ).padStart(
                            3,
                            '0'
                        );


                    targetUrl =
                        `https://hls.tvabierta.net/hls/${numeroFormateado}.m3u8`;
                }


                return {
                    ...canal,
                    url: targetUrl
                };
            }
        );

    } catch (error) {

        console.error(
            'Error cargando channels.json:',
            error.message
        );

        return [];
    }
}


app.get(
    '/api/canales',
    async (req, res) => {

        const lista =
            await obtenerListaCanalesProcesada(
                req
            );


        if (lista.length > 0) {

            res.json(lista);

        } else {

            res
                .status(500)
                .json({
                    error:
                        'No se pudo obtener la lista de canales'
                });
        }
    }
);


app.get(
    '/',
    async (req, res) => {

        const lista =
            await obtenerListaCanalesProcesada(
                req
            );


        if (lista.length > 0) {

            res.json(lista);

        } else {

            res.send(
                'ROKU Backend RD OK'
            );
        }
    }
);


/* =========================================================
   CANAL TELEMICRO
========================================================= */

app.get(
    '/api/telemicro',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                TELEMICRO_PLAYLIST,
                req,
                res,
                'https://telemicro.com.do/'
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 6
========================================================= */

app.get(
    '/api/canal6',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL6_STREAM_URL,
                req,
                res
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 7
========================================================= */

app.get(
    '/api/canal7',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL7_STREAM_URL,
                req,
                res
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 8
========================================================= */

app.get(
    '/api/canal8',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL8_STREAM_URL,
                req,
                res
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 9 - DAILYMOTION
========================================================= */

app.get(
    '/api/canal9',
    async (req, res) => {

        const streamUrlDm =
            await extraerStreamDailymotion(
                CANAL9_VIDEO_ID
            );


        if (streamUrlDm) {

            const exito =
                await procesarPlaylistProxy(
                    streamUrlDm,
                    req,
                    res,
                    'https://www.dailymotion.com/'
                );


            if (exito) {
                return;
            }
        }


        res
            .status(503)
            .send(
                'Señal no disponible para Canal 9'
            );
    }
);


/* =========================================================
   CANAL 10
========================================================= */

app.get(
    '/api/canal10',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL10_STREAM_URL,
                req,
                res
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 11 - DAILYMOTION
========================================================= */

app.get(
    '/api/canal11',
    async (req, res) => {

        const streamUrlDm =
            await extraerStreamDailymotion(
                CANAL11_VIDEO_ID
            );


        if (streamUrlDm) {

            const exito =
                await procesarPlaylistProxy(
                    streamUrlDm,
                    req,
                    res,
                    'https://www.dailymotion.com/'
                );


            if (exito) {
                return;
            }
        }


        res
            .status(503)
            .send(
                'Señal no disponible para Canal 11'
            );
    }
);


/* =========================================================
   CANAL 12 - DAILYMOTION
========================================================= */

app.get(
    '/api/canal12',
    async (req, res) => {

        const streamUrlDm =
            await extraerStreamDailymotion(
                CANAL12_VIDEO_ID
            );


        if (streamUrlDm) {

            const exito =
                await procesarPlaylistProxy(
                    streamUrlDm,
                    req,
                    res,
                    'https://www.dailymotion.com/'
                );


            if (exito) {
                return;
            }
        }


        res
            .status(503)
            .send(
                'Señal no disponible para Canal 12'
            );
    }
);


/* =========================================================
   CANAL 13
========================================================= */

app.get(
    '/api/canal13',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL13_STREAM_URL,
                req,
                res,
                'https://telemicro.com.do/'
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 15
========================================================= */

app.get(
    '/api/canal15',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL15_STREAM_URL,
                req,
                res,
                'https://telemicro.com.do/'
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 18
========================================================= */

app.get(
    '/api/canal18',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL18_STREAM_URL,
                req,
                res
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 19
========================================================= */

app.get(
    '/api/canal19',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL19_STREAM_URL,
                req,
                res
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 21
========================================================= */

app.get(
    '/api/canal21',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL21_STREAM_URL,
                req,
                res
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal'
                );
        }
    }
);


/* =========================================================
   CANAL 23 - DAILYMOTION
========================================================= */

app.get(
    '/api/canal23',
    async (req, res) => {

        const streamUrlDm =
            await extraerStreamDailymotion(
                CANAL23_VIDEO_ID
            );


        if (streamUrlDm) {

            const exito =
                await procesarPlaylistProxy(
                    streamUrlDm,
                    req,
                    res,
                    'https://www.dailymotion.com/'
                );


            if (exito) {
                return;
            }
        }


        res
            .status(503)
            .send(
                'Señal no disponible para Canal 23'
            );
    }
);


/* =========================================================
   CANAL 27
   PRINCIPAL + RESPALDO
========================================================= */

app.get(
    '/api/canal27',
    async (req, res) => {

        if (
            await procesarPlaylistProxy(
                CANAL27_STREAM_URL,
                req,
                res
            )
        ) {

            return;
        }


        if (
            await procesarPlaylistProxy(
                CANAL27_CHUNK_URL,
                req,
                res
            )
        ) {

            return;
        }


        res
            .status(503)
            .send(
                'Error en la señal del Canal 27'
            );
    }
);


/* =========================================================
   CANAL 32
========================================================= */

app.get(
    '/api/canal32',
    async (req, res) => {

        const exito =
            await procesarPlaylistProxy(
                CANAL32_STREAM_URL,
                req,
                res
            );


        if (!exito) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 32'
                );
        }
    }
);


/* =========================================================
   CANAL 36
   DAILYMOTION DINÁMICO
========================================================= */

/*
   NO existe respaldo sec2(...)
   guardado en el código.

   Cada vez que se necesita el Canal 36,
   se intenta obtener una URL nueva usando:

       xar1qcu

   Si la URL obtenida falla al cargar el M3U8,
   se elimina del caché y se vuelve a solicitar
   otra URL nueva.
*/

app.get(
    '/api/canal36',
    async (req, res) => {

        console.log(
            '[CANAL 36] Buscando enlace Dailymotion actualizado...'
        );


        /*
           -----------------------------------------------------
           PRIMER INTENTO
           -----------------------------------------------------
        */

        let streamUrlDm =
            await extraerStreamDailymotion(
                CANAL36_VIDEO_ID
            );


        if (streamUrlDm) {

            console.log(
                `[CANAL 36] URL obtenida: ${streamUrlDm.substring(0, 100)}...`
            );


            const dinamicoOK =
                await procesarPlaylistProxy(
                    streamUrlDm,
                    req,
                    res,
                    'https://www.dailymotion.com/'
                );


            if (dinamicoOK) {

                console.log(
                    '[CANAL 36] Reproduciendo enlace dinámico.'
                );

                return;
            }


            /*
               Si la URL obtenida falló,
               eliminamos el caché.
            */

            dmCache.delete(
                `dm_${CANAL36_VIDEO_ID}`
            );


            console.warn(
                '[CANAL 36] La URL dinámica falló. Se solicitará otra.'
            );
        }


        /*
           -----------------------------------------------------
           SEGUNDO INTENTO
           OBTENER OTRA URL NUEVA
           -----------------------------------------------------
        */

        console.log(
            '[CANAL 36] Segundo intento de obtener URL nueva...'
        );


        streamUrlDm =
            await extraerStreamDailymotion(
                CANAL36_VIDEO_ID
            );


        if (streamUrlDm) {

            const segundoIntento =
                await procesarPlaylistProxy(
                    streamUrlDm,
                    req,
                    res,
                    'https://www.dailymotion.com/'
                );


            if (segundoIntento) {

                console.log(
                    '[CANAL 36] Segundo enlace dinámico funcionando.'
                );

                return;
            }


            dmCache.delete(
                `dm_${CANAL36_VIDEO_ID}`
            );
        }


        /*
           -----------------------------------------------------
           NO HAY STREAM
           -----------------------------------------------------
        */

        console.error(
            '[CANAL 36] No se pudo obtener un M3U8 válido de Dailymotion.'
        );


        res
            .status(503)
            .send(
                'Señal no disponible para Canal 36'
            );
    }
);


/* =========================================================
   CANAL 37
   DAILYMOTION + MANIFEST
========================================================= */

app.get(
    '/api/canal37',
    async (req, res) => {

        const streamUrlDm =
            await extraerStreamDailymotion(
                CANAL37_VIDEO_ID
            );


        if (streamUrlDm) {

            const dinamicoOK =
                await procesarPlaylistProxy(
                    streamUrlDm,
                    req,
                    res,
                    'https://www.televisiondominicanaenvivo.com/'
                );


            if (dinamicoOK) {
                return;
            }
        }


        /*
           Manifest de Dailymotion como alternativa.
           No contiene un token sec2(...) fijo.
        */

        if (
            await procesarPlaylistProxy(
                CANAL37_STREAM_URL,
                req,
                res,
                'https://www.televisiondominicanaenvivo.com/'
            )
        ) {

            return;
        }


        res
            .status(503)
            .send(
                'Señal no disponible para Canal 37'
            );
    }
);


/* =========================================================
   INICIAR SERVIDOR
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Servidor escuchando en puerto ${PORT}`
        );

        console.log(
            `[CANAL 36] Dailymotion ID: ${CANAL36_VIDEO_ID}`
        );

        console.log(
            '[CANAL 36] Sin enlace sec2(...) fijo de respaldo.'
        );
    }
);
