const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

/* =========================================================
   CORS
========================================================= */

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    next();
});

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const CANALES_JSON =
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/* =========================================================
   CANALES
========================================================= */

/* CANAL 5 - TELEMICRO */
const TELEMICRO_PLAYLIST =
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

/* CANAL 6 */
const CANAL6_STREAM_URL =
    'https://stream.elseis.do/canal6/master.m3u8';

/* CANAL 7 - ANTENA 7 */
const CANAL7_STREAM_URL =
    'https://d3gie3ig6argu.cloudfront.net/medialist_15609871089997455276_hls.m3u8';

/* CANAL 8 - TELEMEDIOS */
const CANAL8_VIDEO_ID = 'x9hvyy0';


/* =========================================================
   OBTENER URL BASE DEL SERVIDOR
========================================================= */

function obtenerBaseUrl(req) {

    const protocol =
        req.headers['x-forwarded-proto'] || req.protocol;

    const host =
        req.headers['x-forwarded-host'] || req.get('host');

    return `${protocol}://${host}`;
}


/* =========================================================
   EXTRACTOR DAILYMOTION
   CANAL 8
========================================================= */

async function obtenerStreamDailymotionFresco(videoId) {

    /* -----------------------------------------------------
       MÉTODO 1
       Player Metadata
    ----------------------------------------------------- */

    try {

        const metadataUrl =
            `https://www.dailymotion.com/player/metadata/video/${videoId}`;

        const respuesta = await axios.get(metadataUrl, {

            httpsAgent,

            timeout: 10000,

            headers: {

                'User-Agent': USER_AGENT,

                'Referer':
                    `https://www.dailymotion.com/embed/video/${videoId}`

            }

        });


        if (respuesta.data?.qualities) {

            const qualities =
                respuesta.data.qualities;

            const autoList =
                qualities.auto ||
                Object.values(qualities).flat();

            const videoStream =
                autoList.find(q =>
                    q.url &&
                    (
                        q.url.includes('.m3u8') ||
                        q.url.includes('manifest')
                    )
                );

            if (videoStream?.url) {

                console.log(
                    `[Dailymotion] Stream encontrado para ${videoId}`
                );

                return videoStream.url;
            }
        }

    } catch (error) {

        console.error(
            `[Dailymotion API] Error en ${videoId}:`,
            error.message
        );

    }


    /* -----------------------------------------------------
       MÉTODO 2
       EMBED
    ----------------------------------------------------- */

    try {

        const embedUrl =
            `https://www.dailymotion.com/embed/video/${videoId}`;

        const respuesta =
            await axios.get(embedUrl, {

                httpsAgent,

                timeout: 10000,

                headers: {

                    'User-Agent': USER_AGENT

                }

            });


        const match =
            respuesta.data.match(
                /https%3A%2F%2F[^\s"'\\]+\.m3u8[^\s"'\\]*/
            );


        if (match) {

            const decodedUrl =
                decodeURIComponent(match[0]);

            console.log(
                `[Dailymotion] Stream encontrado mediante Embed`
            );

            return decodedUrl;
        }


        /* También intentamos encontrar una URL m3u8
           sin codificar */

        const matchDirect =
            respuesta.data.match(
                /https?:\/\/[^"'\\\s]+\.m3u8[^"'\\\s]*/
            );


        if (matchDirect) {

            console.log(
                `[Dailymotion] Stream directo encontrado`
            );

            return matchDirect[0];
        }

    } catch (error) {

        console.error(
            `[Dailymotion Embed] Error en ${videoId}:`,
            error.message
        );

    }


    return null;
}


/* =========================================================
   PROCESADOR HLS
========================================================= */

async function procesarPlaylistProxy(
    streamUrl,
    req,
    res,
    referer = ''
) {

    try {

        const headers = {

            'User-Agent': USER_AGENT

        };


        if (referer) {

            headers['Referer'] = referer;

        }


        const respuesta =
            await axios.get(streamUrl, {

                httpsAgent,

                timeout: 15000,

                responseType: 'text',

                headers

            });


        const baseUrl =
            obtenerBaseUrl(req);


        const lineas =
            respuesta.data.split(/\r?\n/);


        const nuevasLineas =
            lineas.map(linea => {

                const texto =
                    linea.trim();


                /* ------------------------------------------------
                   Líneas normales del M3U8
                ------------------------------------------------ */

                if (
                    texto &&
                    !texto.startsWith('#')
                ) {

                    try {

                        const urlAbsoluta =
                            new URL(
                                texto,
                                streamUrl
                            ).href;


                        /* ----------------------------------------
                           SUBPLAYLIST
                        ---------------------------------------- */

                        if (
                            texto.includes('.m3u8') ||
                            urlAbsoluta.includes('.m3u8')
                        ) {

                            return (
                                `${baseUrl}/api/proxy/subplaylist` +
                                `?url=${encodeURIComponent(urlAbsoluta)}` +
                                `&ref=${encodeURIComponent(streamUrl)}`
                            );

                        }


                        /* ----------------------------------------
                           SEGMENTO
                        ---------------------------------------- */

                        return (
                            `${baseUrl}/api/proxy/segment` +
                            `?url=${encodeURIComponent(urlAbsoluta)}` +
                            `&ref=${encodeURIComponent(streamUrl)}`
                        );


                    } catch (error) {

                        console.error(
                            'Error convirtiendo URL:',
                            texto,
                            error.message
                        );

                        return linea;

                    }

                }


                /* ------------------------------------------------
                   Mantener etiquetas #EXT...
                ------------------------------------------------ */

                return linea;

            });


        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl'
        );


        res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );


        res.setHeader(
            'Pragma',
            'no-cache'
        );


        res.setHeader(
            'Expires',
            '0'
        );


        res.send(
            nuevasLineas.join('\n')
        );


    } catch (error) {

        console.error(
            'Error procesando playlist:',
            streamUrl,
            error.message
        );


        if (!res.headersSent) {

            res.status(500).send(
                'Error en transmisión'
            );

        }

    }

}


/* =========================================================
   PROXY DE SUBPLAYLIST
========================================================= */

app.get(
    '/api/proxy/subplaylist',
    async (req, res) => {

        const {
            url,
            ref
        } = req.query;


        if (!url) {

            return res
                .status(400)
                .send('Falta URL');

        }


        await procesarPlaylistProxy(
            url,
            req,
            res,
            ref || ''
        );

    }
);


/* =========================================================
   PROXY DE SEGMENTOS
========================================================= */

app.get(
    '/api/proxy/segment',
    async (req, res) => {

        try {

            const {
                url,
                ref
            } = req.query;


            if (!url) {

                return res
                    .status(400)
                    .send(
                        'Falta URL de segmento'
                    );

            }


            const headers = {

                'User-Agent':
                    USER_AGENT

            };


            if (ref) {

                headers['Referer'] =
                    ref;

            }


            const respuesta =
                await axios.get(
                    url,
                    {

                        httpsAgent,

                        timeout: 20000,

                        responseType:
                            'arraybuffer',

                        headers

                    }
                );


            res.setHeader(
                'Content-Type',
                respuesta.headers[
                    'content-type'
                ] || 'video/mp2t'
            );


            res.setHeader(
                'Cache-Control',
                'no-cache'
            );


            res.send(
                respuesta.data
            );


        } catch (error) {

            console.error(
                'Error obteniendo segmento:',
                error.message
            );


            if (!res.headersSent) {

                res
                    .status(500)
                    .send(
                        'Error de segmento'
                    );

            }

        }

    }
);


/* =========================================================
   1. LISTA PRINCIPAL DE CANALES
========================================================= */

app.get(
    '/api/canales',
    async (req, res) => {

        try {

            const respuesta =
                await axios.get(
                    CANALES_JSON,
                    {
                        timeout: 15000
                    }
                );


            const canales =
                respuesta.data;


            const baseUrl =
                obtenerBaseUrl(req);


            const resultado =
                canales.map(canal => {

                    /* CANAL 5 */

                    if (
                        canal.telemicro_web === true
                    ) {

                        return {

                            ...canal,

                            url:
                                `${baseUrl}/api/telemicro`

                        };

                    }


                    /* CANAL 6 */

                    if (
                        canal.canal6_web === true
                    ) {

                        return {

                            ...canal,

                            url:
                                `${baseUrl}/api/canal6`

                        };

                    }


                    /* CANAL 7 */

                    if (
                        canal.canal7_web === true
                    ) {

                        return {

                            ...canal,

                            url:
                                `${baseUrl}/api/canal7`

                        };

                    }


                    /* CANAL 8 */

                    if (
                        canal.canal8_web === true
                    ) {

                        return {

                            ...canal,

                            url:
                                `${baseUrl}/api/canal8`

                        };

                    }


                    return canal;

                });


            res.json(
                resultado
            );


        } catch (error) {

            console.error(
                'Error obteniendo canales:',
                error.message
            );


            res
                .status(500)
                .json({

                    error:
                        'No se pudo obtener la lista de canales'

                });

        }

    }
);


/* =========================================================
   2. CANAL 5 - TELEMICRO
========================================================= */

app.get(
    '/api/telemicro',
    async (req, res) => {

        await procesarPlaylistProxy(
            TELEMICRO_PLAYLIST,
            req,
            res,
            'https://telemicro.com.do/'
        );

    }
);


/* =========================================================
   3. CANAL 7 - ANTENA 7
========================================================= */

app.get(
    '/api/canal7',
    async (req, res) => {

        console.log(
            'Solicitando Canal 7'
        );

        console.log(
            'Fuente:',
            CANAL7_STREAM_URL
        );


        await procesarPlaylistProxy(
            CANAL7_STREAM_URL,
            req,
            res
        );

    }
);


/* =========================================================
   4. CANAL 8 - TELEMEDIOS
========================================================= */

app.get(
    '/api/canal8',
    async (req, res) => {

        console.log(
            'Solicitando Canal 8'
        );


        const streamUrl =
            await obtenerStreamDailymotionFresco(
                CANAL8_VIDEO_ID
            );


        if (!streamUrl) {

            return res
                .status(503)
                .send(
                    'Sin señal Canal 8'
                );

        }


        /*
         * En lugar de enviar directamente al Roku,
         * procesamos la playlist mediante nuestro proxy.
         */

        await procesarPlaylistProxy(
            streamUrl,
            req,
            res,
            'https://www.dailymotion.com/'
        );

    }
);


/* =========================================================
   5. CANAL 6
========================================================= */

app.get(
    '/api/canal6',
    async (req, res) => {

        await procesarPlaylistProxy(
            CANAL6_STREAM_URL,
            req,
            res
        );

    }
);


/* =========================================================
   PÁGINA PRINCIPAL
========================================================= */

app.get(
    '/',
    (req, res) => {

        res.send(
            'ROKU Backend RD funcionando correctamente'
        );

    }
);


/* =========================================================
   INICIO DEL SERVIDOR
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Servidor escuchando en puerto ${PORT}`
        );

    }
);
