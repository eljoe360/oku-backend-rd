const express = require('express');
const axios = require('axios');

const app = express();

const PORT = process.env.PORT || 3000;

const GITHUB_JSON_URL =
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';


// ======================================================
// TELEMICRO - CANAL 5
// ======================================================

const TELEMICRO_PLAYLIST =
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

const TELEMICRO_BASE =
    'https://live2.telemicro.com.do/live/55/';


// ======================================================
// CANAL 6
// ======================================================

const CANAL6_MASTER =
    'https://stream.elseis.do/canal6/master.m3u8';

const CANAL6_HOST =
    'https://stream.elseis.do';


// ======================================================
// CANAL 7
// ======================================================

const CANAL7_MASTER =
    'https://d3gie3ig6argu.cloudfront.net/medialist_15609871089997455276_hls.m3u8';

const CANAL7_HOST =
    'https://d3gie3ig6argu.cloudfront.net';

const CANAL7_REFERER =
    'https://www.teleantillas.com.do/';


// ======================================================
// TELEMICRO - OBTENER STREAM
// ======================================================

async function obtenerStreamTelemicro() {

    try {

        const sessionRes =
            await axios.get(
                'https://telemicro.com.do/telemicro-en-vivo/',
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
                    },

                    timeout: 15000,
                    maxRedirects: 5
                }
            );

        const cookies =
            sessionRes.headers['set-cookie']
                ? sessionRes.headers['set-cookie'].join('; ')
                : '';

        const playlistRes =
            await axios.get(
                TELEMICRO_PLAYLIST,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0',

                        'Accept':
                            'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

                        'Referer':
                            'https://telemicro.com.do/',

                        'Origin':
                            'https://telemicro.com.do/',

                        'Cookie':
                            cookies
                    },

                    timeout: 15000,
                    maxRedirects: 5,
                    validateStatus: () => true
                }
            );

        console.log(
            'Respuesta playlist Telemicro:',
            playlistRes.status
        );

        if (
            playlistRes.status < 200 ||
            playlistRes.status >= 300
        ) {

            throw new Error(
                `Telemicro respondió HTTP ${playlistRes.status}`
            );
        }

        const playlist =
            String(playlistRes.data);

        const match =
            playlist.match(
                /(?:https?:\/\/[^"\s]+\/)?chunks\.m3u8(?:\?[^"\s]+)?/i
            );

        let streamUrl = null;

        if (
            match &&
            match[0]
        ) {

            streamUrl =
                match[0];

            if (
                streamUrl.startsWith('/')
            ) {

                streamUrl =
                    'https://live2.telemicro.com.do' +
                    streamUrl;

            } else if (
                streamUrl.startsWith('chunks.m3u8')
            ) {

                streamUrl =
                    TELEMICRO_BASE +
                    streamUrl;
            }

        } else {

            const sessionMatch =
                playlist.match(
                    /nimblesessionid[=:%]\s*(\d+)/i
                );

            if (
                sessionMatch &&
                sessionMatch[1]
            ) {

                streamUrl =
                    `${TELEMICRO_BASE}chunks.m3u8?nimblesessionid=${sessionMatch[1]}`;
            }
        }

        if (
            !streamUrl
        ) {

            throw new Error(
                'No se encontró chunks.m3u8 ni nimblesessionid'
            );
        }

        console.log(
            'Stream Telemicro encontrado:',
            streamUrl
        );

        return {
            streamUrl,
            cookies
        };

    } catch (error) {

        console.error(
            'ERROR OBTENIENDO TELEMICRO:',
            error.message
        );

        return null;
    }
}


// ======================================================
// TELEMICRO - PLAYLIST
// ======================================================

async function obtenerPlaylistTelemicro() {

    const session =
        await obtenerStreamTelemicro();

    if (
        !session ||
        !session.streamUrl
    ) {

        return null;
    }

    try {

        const response =
            await axios.get(
                session.streamUrl,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0',

                        'Accept':
                            'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

                        'Referer':
                            'https://telemicro.com.do/',

                        'Origin':
                            'https://telemicro.com.do/',

                        'Cookie':
                            session.cookies
                    },

                    timeout: 15000
                }
            );

        const playlist =
            String(response.data);

        const nuevasLineas =
            playlist.split('\n').map(
                line => {

                    const linea =
                        line.trim();

                    if (
                        !linea ||
                        linea.startsWith('#')
                    ) {

                        return line;
                    }

                    const urlCompleta =
                        new URL(
                            linea,
                            session.streamUrl
                        ).href;

                    return (
                        '/api/telemicro/proxy?url=' +
                        encodeURIComponent(urlCompleta) +
                        '&cookie=' +
                        encodeURIComponent(session.cookies)
                    );
                }
            );

        return nuevasLineas.join('\n');

    } catch (error) {

        console.error(
            'ERROR PLAYLIST TELEMICRO:',
            error.message
        );

        return null;
    }
}


// ======================================================
// PROXY TELEMICRO
// ======================================================

app.get(
    '/api/telemicro/proxy',
    async (req, res) => {

        try {

            const url =
                req.query.url;

            const cookie =
                req.query.cookie;

            if (
                !url
            ) {

                return res.status(400).send(
                    'Falta parámetro url'
                );
            }

            const response =
                await axios.get(
                    url,
                    {
                        responseType:
                            'arraybuffer',

                        headers: {
                            'User-Agent':
                                'Mozilla/5.0',

                            'Accept':
                                '*/*',

                            'Referer':
                                'https://telemicro.com.do/',

                            'Origin':
                                'https://telemicro.com.do/',

                            'Cookie':
                                cookie || ''
                        },

                        timeout: 15000
                    }
                );

            res.setHeader(
                'Content-Type',
                response.headers['content-type'] ||
                'video/mp2t'
            );

            res.send(
                Buffer.from(
                    response.data
                )
            );

        } catch (error) {

            console.error(
                'ERROR PROXY TELEMICRO:',
                error.message
            );

            res.status(502).send(
                'Error obteniendo segmento de Telemicro'
            );
        }
    }
);


// ======================================================
// STREAM TELEMICRO
// ======================================================

app.get(
    '/api/telemicro',
    async (req, res) => {

        console.log(
            'Roku solicitó Telemicro'
        );

        const playlist =
            await obtenerPlaylistTelemicro();

        if (
            !playlist
        ) {

            return res.status(503).send(
                'No se pudo obtener Telemicro'
            );
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );

        res.send(
            playlist
        );
    }
);


// ======================================================
// CANAL 6 - PLAYLIST
// ======================================================

async function obtenerPlaylistCanal6(url) {

    try {

        const response =
            await axios.get(
                url,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0',

                        'Accept':
                            'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

                        'Referer':
                            'https://www.elseis.do/',

                        'Origin':
                            'https://www.elseis.do/'
                    },

                    timeout: 15000,
                    maxRedirects: 5
                }
            );

        const playlist =
            String(response.data);

        const baseUrl =
            new URL(url);

        const nuevasLineas =
            playlist.split('\n').map(
                line => {

                    const linea =
                        line.trim();

                    if (
                        !linea ||
                        linea.startsWith('#')
                    ) {

                        return line;
                    }

                    const urlCompleta =
                        new URL(
                            linea,
                            baseUrl
                        ).href;

                    return (
                        '/api/canal6/proxy?url=' +
                        encodeURIComponent(urlCompleta)
                    );
                }
            );

        return nuevasLineas.join('\n');

    } catch (error) {

        console.error(
            'ERROR CANAL 6:',
            error.message
        );

        return null;
    }
}


// ======================================================
// PROXY CANAL 6
// ======================================================

app.get(
    '/api/canal6/proxy',
    async (req, res) => {

        try {

            const url =
                req.query.url;

            if (
                !url
            ) {

                return res.status(400).send(
                    'Falta parámetro url'
                );
            }

            if (
                !url.startsWith(
                    CANAL6_HOST
                )
            ) {

                return res.status(403).send(
                    'URL no permitida'
                );
            }

            const response =
                await axios.get(
                    url,
                    {
                        responseType:
                            'arraybuffer',

                        headers: {
                            'User-Agent':
                                'Mozilla/5.0',

                            'Accept':
                                '*/*',

                            'Referer':
                                'https://www.elseis.do/',

                            'Origin':
                                'https://www.elseis.do/'
                        },

                        timeout: 15000,
                        maxRedirects: 5
                    }
                );

            const contentType =
                String(
                    response.headers['content-type'] ||
                    ''
                ).toLowerCase();

            if (
                contentType.includes('mpegurl') ||
                url.includes('.m3u8')
            ) {

                const playlist =
                    Buffer
                        .from(response.data)
                        .toString('utf8');

                const baseUrl =
                    new URL(url);

                const nuevasLineas =
                    playlist.split('\n').map(
                        line => {

                            const linea =
                                line.trim();

                            if (
                                !linea ||
                                linea.startsWith('#')
                            ) {

                                return line;
                            }

                            const urlCompleta =
                                new URL(
                                    linea,
                                    baseUrl
                                ).href;

                            return (
                                '/api/canal6/proxy?url=' +
                                encodeURIComponent(
                                    urlCompleta
                                )
                            );
                        }
                    );

                res.setHeader(
                    'Content-Type',
                    'application/vnd.apple.mpegurl'
                );

                return res.send(
                    nuevasLineas.join('\n')
                );
            }

            res.setHeader(
                'Content-Type',
                response.headers['content-type'] ||
                'video/mp2t'
            );

            res.send(
                Buffer.from(
                    response.data
                )
            );

        } catch (error) {

            console.error(
                'ERROR PROXY CANAL 6:',
                error.message
            );

            res.status(502).send(
                'Error obteniendo Canal 6'
            );
        }
    }
);


// ======================================================
// STREAM CANAL 6
// ======================================================

app.get(
    '/api/canal6',
    async (req, res) => {

        console.log(
            'Roku solicitó Canal 6'
        );

        const playlist =
            await obtenerPlaylistCanal6(
                CANAL6_MASTER
            );

        if (
            !playlist
        ) {

            return res.status(503).send(
                'No se pudo obtener Canal 6'
            );
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );

        res.send(
            playlist
        );
    }
);


// ======================================================
// CANAL 7 - PLAYLIST
// ======================================================

async function obtenerPlaylistCanal7() {

    try {

        console.log(
            'Solicitando Canal 7:',
            CANAL7_MASTER
        );

        const response =
            await axios.get(
                CANAL7_MASTER,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                        'Accept':
                            'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

                        'Accept-Language':
                            'es-DO,es;q=0.9,en;q=0.8',

                        'Referer':
                            CANAL7_REFERER,

                        'Origin':
                            'https://www.teleantillas.com.do'
                    },

                    timeout: 30000,
                    maxRedirects: 10,
                    validateStatus: () => true
                }
            );

        console.log(
            'CANAL 7 HTTP:',
            response.status
        );

        if (
            response.status < 200 ||
            response.status >= 300
        ) {

            console.error(
                'CANAL 7 RESPONDIÓ:',
                response.status
            );

            return null;
        }

        const playlist =
            Buffer
                .from(response.data)
                .toString('utf8');

        const baseUrl =
            new URL(
                CANAL7_MASTER
            );

        const nuevasLineas =
            playlist.split('\n').map(
                line => {

                    const linea =
                        line.trim();

                    if (
                        !linea ||
                        linea.startsWith('#')
                    ) {

                        return line;
                    }

                    const urlCompleta =
                        new URL(
                            linea,
                            baseUrl
                        ).href;

                    return (
                        '/api/canal7/proxy?url=' +
                        encodeURIComponent(
                            urlCompleta
                        )
                    );
                }
            );

        return nuevasLineas.join('\n');

    } catch (error) {

        console.error(
            'ERROR CANAL 7:',
            error.message
        );

        return null;
    }
}


// ======================================================
// PROXY CANAL 7
// ======================================================

app.get(
    '/api/canal7/proxy',
    async (req, res) => {

        try {

            const url =
                req.query.url;

            if (
                !url
            ) {

                return res.status(400).send(
                    'Falta parámetro url'
                );
            }

            if (
                !url.startsWith(
                    CANAL7_HOST
                )
            ) {

                console.error(
                    'CANAL 7 URL BLOQUEADA:',
                    url
                );

                return res.status(403).send(
                    'URL no permitida'
                );
            }

            console.log(
                'CANAL 7 PROXY:',
                url
            );

            const response =
                await axios.get(
                    url,
                    {
                        responseType:
                            'arraybuffer',

                        headers: {
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                            'Accept':
                                '*/*',

                            'Accept-Language':
                                'es-DO,es;q=0.9,en;q=0.8',

                            'Referer':
                                CANAL7_REFERER,

                            'Origin':
                                'https://www.teleantillas.com.do'
                        },

                        timeout: 30000,

                        maxRedirects: 10,

                        validateStatus: () => true
                    }
                );

            console.log(
                'CANAL 7 SEGMENTO HTTP:',
                response.status,
                'SIZE:',
                response.data.length
            );

            if (
                response.status < 200 ||
                response.status >= 300
            ) {

                return res.status(
                    response.status
                ).send(
                    'Error del servidor de Canal 7'
                );
            }

            const contentType =
                String(
                    response.headers['content-type'] ||
                    ''
                ).toLowerCase();

            const esPlaylist =
                contentType.includes('mpegurl') ||
                contentType.includes('m3u8') ||
                url.includes('.m3u8');

            if (
                esPlaylist
            ) {

                const playlist =
                    Buffer
                        .from(response.data)
                        .toString('utf8');

                const baseUrl =
                    new URL(url);

                const nuevasLineas =
                    playlist.split('\n').map(
                        line => {

                            const linea =
                                line.trim();

                            if (
                                !linea ||
                                linea.startsWith('#')
                            ) {

                                return line;
                            }

                            const urlCompleta =
                                new URL(
                                    linea,
                                    baseUrl
                                ).href;

                            return (
                                '/api/canal7/proxy?url=' +
                                encodeURIComponent(
                                    urlCompleta
                                )
                            );
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

                return res.send(
                    nuevasLineas.join('\n')
                );
            }

            res.statusCode = 200;

            res.setHeader(
                'Content-Type',
                'video/mp2t'
            );

            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );

            res.setHeader(
                'Content-Length',
                response.data.length
            );

            return res.end(
                Buffer.from(
                    response.data
                )
            );

        } catch (error) {

            console.error(
                'ERROR PROXY CANAL 7:',
                error.message
            );

            res.status(502).send(
                'Error obteniendo segmento de Canal 7'
            );
        }
    }
);


// ======================================================
// STREAM CANAL 7
// ======================================================

app.get(
    '/api/canal7',
    async (req, res) => {

        console.log(
            'Roku solicitó Canal 7'
        );

        const playlist =
            await obtenerPlaylistCanal7();

        if (
            !playlist
        ) {

            return res.status(503).send(
                'No se pudo obtener Canal 7'
            );
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );

        res.send(
            playlist
        );
    }
);


// ======================================================
// API DE CANALES
// ======================================================

app.get(
    '/api/canales',
    async (req, res) => {

        try {

            const response =
                await axios.get(
                    GITHUB_JSON_URL,
                    {
                        headers: {
                            'User-Agent':
                                'Mozilla/5.0'
                        },

                        timeout: 10000
                    }
                );

            let canales =
                typeof response.data === 'string'
                    ? JSON.parse(response.data)
                    : response.data;

            const hoy =
                new Date()
                    .toISOString()
                    .split('T')[0];

            const vigentes =
                canales.filter(
                    canal =>
                        !canal.vencimiento ||
                        canal.vencimiento >= hoy
                );

            const resultados =
                vigentes.map(
                    canal => {

                        const c = {
                            ...canal
                        };

                        if (
                            c.telemicro_web
                        ) {

                            c.url =
                                'https://oku-backend-rd.onrender.com/api/telemicro';
                        }

                        return c;
                    }
                );

            res.json(
                resultados
            );

        } catch (error) {

            console.error(
                'ERROR GENERAL:',
                error.message
            );

            res.status(500).json({
                error:
                    'Error al procesar la lista de canales'
            });
        }
    }
);


// ======================================================
// PRUEBA DEL SERVIDOR
// ======================================================

app.get(
    '/',
    (req, res) => {

        res.send(
            'OKU Backend RD funcionando'
        );
    }
);


// ======================================================
// INICIAR SERVIDOR EN RENDER
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            `Servidor activo en el puerto ${PORT}`
        );
    }
);
