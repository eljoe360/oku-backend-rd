const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_JSON_URL =
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';


// ======================================================
// TELEMiCRO
// ======================================================

const TELEMICRO_PLAYLIST =
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

const TELEMICRO_BASE =
    'https://live2.telemicro.com.do/live/55/';

let telemicroSession = {
    streamUrl: null,
    cookies: '',
    updatedAt: 0
};


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


// ======================================================
// OBTENER STREAM DINÁMICO DE TELEMICRO
// ======================================================

async function obtenerStreamTelemicro() {

    try {

        console.log('======================================');
        console.log('BUSCANDO NUEVA SESIÓN DE TELEMICRO');
        console.log('======================================');

        const sessionRes =
            await axios.get(
                'https://telemicro.com.do/telemicro-en-vivo/',
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                        'Accept':
                            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                    },

                    timeout: 15000,
                    maxRedirects: 5
                }
            );

        const cookies =
            sessionRes.headers['set-cookie']
                ? sessionRes.headers['set-cookie'].join('; ')
                : '';

        console.log(
            'Cookies Telemicro:',
            cookies ? 'OBTENIDAS' : 'NINGUNA'
        );

        const playlistRes =
            await axios.get(
                TELEMICRO_PLAYLIST,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

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
            typeof playlistRes.data === 'string'
                ? playlistRes.data
                : String(playlistRes.data);

        console.log(
            'Playlist recibida:',
            playlist.substring(0, 500)
        );

        const match =
            playlist.match(
                /(?:https?:\/\/[^"\s]+\/)?chunks\.m3u8(?:\?[^"\s]+)?/i
            );

        if (
            match &&
            match[0]
        ) {

            let streamUrl =
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

            console.log(
                'STREAM TELEMICRO ENCONTRADO:'
            );

            console.log(
                streamUrl
            );

            telemicroSession = {
                streamUrl: streamUrl,
                cookies: cookies,
                updatedAt: Date.now()
            };

            return streamUrl;
        }

        const sessionMatch =
            playlist.match(
                /nimblesessionid[=:%]\s*(\d+)/i
            );

        if (
            sessionMatch &&
            sessionMatch[1]
        ) {

            const sessionId =
                sessionMatch[1];

            const streamUrl =
                `${TELEMICRO_BASE}chunks.m3u8?nimblesessionid=${sessionId}`;

            console.log(
                'STREAM TELEMICRO POR SESSION ID:'
            );

            console.log(
                streamUrl
            );

            telemicroSession = {
                streamUrl: streamUrl,
                cookies: cookies,
                updatedAt: Date.now()
            };

            return streamUrl;
        }

        throw new Error(
            'No se encontró chunks.m3u8 ni nimblesessionid en la playlist'
        );

    } catch (error) {

        console.error(
            'ERROR OBTENIENDO TELEMICRO:'
        );

        console.error(
            error.message
        );

        return null;
    }
}


// ======================================================
// OBTENER PLAYLIST DE TELEMICRO
// ======================================================

async function obtenerPlaylistTelemicro() {

    const ahora =
        Date.now();

    if (
        !telemicroSession.streamUrl ||
        ahora - telemicroSession.updatedAt > 5 * 60 * 1000
    ) {

        await obtenerStreamTelemicro();
    }

    if (
        !telemicroSession.streamUrl
    ) {

        return null;
    }

    try {

        const response =
            await axios.get(
                telemicroSession.streamUrl,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                        'Accept':
                            'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

                        'Referer':
                            'https://telemicro.com.do/',

                        'Origin':
                            'https://telemicro.com.do/',

                        'Cookie':
                            telemicroSession.cookies
                    },

                    timeout: 15000
                }
            );

        let playlist =
            typeof response.data === 'string'
                ? response.data
                : String(response.data);

        const lines =
            playlist.split('\n');

        const nuevasLineas =
            lines.map(
                line => {

                    const linea =
                        line.trim();

                    if (
                        !linea ||
                        linea.startsWith('#')
                    ) {

                        return line;
                    }

                    return (
                        '/api/telemicro/proxy?url=' +
                        encodeURIComponent(
                            new URL(
                                linea,
                                telemicroSession.streamUrl
                            ).href
                        )
                    );
                }
            );

        playlist =
            nuevasLineas.join('\n');

        return playlist;

    } catch (error) {

        console.error(
            'Error obteniendo playlist proxy:',
            error.message
        );

        await obtenerStreamTelemicro();

        return null;
    }
}


// ======================================================
// PROXY TELEMiCRO
// ======================================================

app.get(
    '/api/telemicro/proxy',
    async (req, res) => {

        try {

            const url =
                req.query.url;

            if (!url) {

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
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                            'Accept':
                                '*/*',

                            'Referer':
                                'https://telemicro.com.do/',

                            'Origin':
                                'https://telemicro.com.do/',

                            'Cookie':
                                telemicroSession.cookies
                        },

                        timeout: 15000
                    }
                );

            const contentType =
                response.headers[
                    'content-type'
                ] || 'video/mp2t';

            res.setHeader(
                'Content-Type',
                contentType
            );

            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );

            res.send(
                Buffer.from(
                    response.data
                )
            );

        } catch (error) {

            console.error(
                'ERROR EN PROXY TELEMiCRO:',
                error.message
            );

            res.status(502).send(
                'Error obteniendo segmento de Telemicro'
            );
        }
    }
);


// ======================================================
// STREAM PRINCIPAL TELEMiCRO
// ======================================================

app.get(
    '/api/telemicro',
    async (req, res) => {

        console.log(
            'Roku solicitó Telemicro'
        );

        const playlist =
            await obtenerPlaylistTelemicro();

        if (!playlist) {

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
// CANAL 6
// OBTENER Y REESCRIBIR PLAYLIST
// ======================================================

async function obtenerPlaylistCanal6(url) {

    try {

        console.log(
            'Canal 6 solicitando:',
            url
        );

        const response =
            await axios.get(
                url,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

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

        let playlist =
            typeof response.data === 'string'
                ? response.data
                : String(response.data);

        const baseUrl =
            new URL(url);

        const lines =
            playlist.split('\n');

        const nuevasLineas =
            lines.map(
                line => {

                    const linea =
                        line.trim();

                    if (
                        !linea
                    ) {

                        return line;
                    }

                    if (
                        linea.startsWith('#')
                    ) {

                        if (
                            linea.includes('URI="')
                        ) {

                            return linea.replace(
                                /URI="([^"]+)"/g,
                                (match, uri) => {

                                    const urlCompleta =
                                        new URL(
                                            uri,
                                            baseUrl
                                        ).href;

                                    return (
                                        'URI="/api/canal6/proxy?url=' +
                                        encodeURIComponent(
                                            urlCompleta
                                        ) +
                                        '"'
                                    );
                                }
                            );
                        }

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

        playlist =
            nuevasLineas.join('\n');

        return playlist;

    } catch (error) {

        console.error(
            'ERROR OBTENIENDO PLAYLIST CANAL 6:',
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

            if (!url) {

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

            console.log(
                'Canal 6 proxy:',
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
                    response.headers[
                        'content-type'
                    ] || ''
                ).toLowerCase();

            const esPlaylist =
                contentType.includes(
                    'mpegurl'
                ) ||
                url.includes(
                    '.m3u8'
                );

            if (
                esPlaylist
            ) {

                const playlist =
                    Buffer
                        .from(
                            response.data
                        )
                        .toString(
                            'utf8'
                        );

                const baseUrl =
                    new URL(url);

                const lines =
                    playlist.split('\n');

                const nuevasLineas =
                    lines.map(
                        line => {

                            const linea =
                                line.trim();

                            if (
                                !linea
                            ) {

                                return line;
                            }

                            if (
                                linea.startsWith('#')
                            ) {

                                if (
                                    linea.includes(
                                        'URI="'
                                    )
                                ) {

                                    return linea.replace(
                                        /URI="([^"]+)"/g,
                                        (match, uri) => {

                                            const urlCompleta =
                                                new URL(
                                                    uri,
                                                    baseUrl
                                                ).href;

                                            return (
                                                'URI="/api/canal6/proxy?url=' +
                                                encodeURIComponent(
                                                    urlCompleta
                                                ) +
                                                '"'
                                            );
                                        }
                                    );
                                }

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

                const playlistFinal =
                    nuevasLineas.join('\n');

                res.setHeader(
                    'Content-Type',
                    'application/vnd.apple.mpegurl'
                );

                res.setHeader(
                    'Cache-Control',
                    'no-cache, no-store, must-revalidate'
                );

                return res.send(
                    playlistFinal
                );
            }

            const tipo =
                response.headers[
                    'content-type'
                ] || 'video/mp2t';

            res.setHeader(
                'Content-Type',
                tipo
            );

            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );

            return res.send(
                Buffer.from(
                    response.data
                )
            );

        } catch (error) {

            console.error(
                'ERROR PROXY CANAL 6:',
                error.message
            );

            return res.status(502).send(
                'Error obteniendo Canal 6'
            );
        }
    }
);


// ======================================================
// STREAM PRINCIPAL CANAL 6
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

        if (!playlist) {

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
// CANAL 7
// OBTENER Y REESCRIBIR PLAYLIST
// ======================================================

async function obtenerPlaylistCanal7(url) {

    try {

        console.log(
            'Canal 7 solicitando:',
            url
        );

        const response =
            await axios.get(
                url,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                        'Accept':
                            'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
                    },

                    timeout: 15000,

                    maxRedirects: 5
                }
            );

        let playlist =
            typeof response.data === 'string'
                ? response.data
                : String(response.data);

        const baseUrl =
            new URL(url);

        const lines =
            playlist.split('\n');

        const nuevasLineas =
            lines.map(
                line => {

                    const linea =
                        line.trim();

                    if (
                        !linea
                    ) {

                        return line;
                    }

                    if (
                        linea.startsWith('#')
                    ) {

                        if (
                            linea.includes(
                                'URI="'
                            )
                        ) {

                            return linea.replace(
                                /URI="([^"]+)"/g,
                                (match, uri) => {

                                    const urlCompleta =
                                        new URL(
                                            uri,
                                            baseUrl
                                        ).href;

                                    return (
                                        'URI="/api/canal7/proxy?url=' +
                                        encodeURIComponent(
                                            urlCompleta
                                        ) +
                                        '"'
                                    );
                                }
                            );
                        }

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

        playlist =
            nuevasLineas.join('\n');

        return playlist;

    } catch (error) {

        console.error(
            'ERROR OBTENIENDO PLAYLIST CANAL 7:',
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

            if (!url) {

                return res.status(400).send(
                    'Falta parámetro url'
                );
            }

            if (
                !url.startsWith(
                    CANAL7_HOST
                )
            ) {

                return res.status(403).send(
                    'URL no permitida'
                );
            }

            console.log(
                'Canal 7 proxy:',
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
                                '*/*'
                        },

                        timeout: 15000,

                        maxRedirects: 5
                    }
                );

            const contentType =
                String(
                    response.headers[
                        'content-type'
                    ] || ''
                ).toLowerCase();

            const esPlaylist =
                contentType.includes(
                    'mpegurl'
                ) ||
                url.includes(
                    '.m3u8'
                );

            if (
                esPlaylist
            ) {

                const playlist =
                    Buffer
                        .from(
                            response.data
                        )
                        .toString(
                            'utf8'
                        );

                const baseUrl =
                    new URL(url);

                const lines =
                    playlist.split('\n');

                const nuevasLineas =
                    lines.map(
                        line => {

                            const linea =
                                line.trim();

                            if (
                                !linea
                            ) {

                                return line;
                            }

                            if (
                                linea.startsWith('#')
                            ) {

                                if (
                                    linea.includes(
                                        'URI="'
                                    )
                                ) {

                                    return linea.replace(
                                        /URI="([^"]+)"/g,
                                        (match, uri) => {

                                            const urlCompleta =
                                                new URL(
                                                    uri,
                                                    baseUrl
                                                ).href;

                                            return (
                                                'URI="/api/canal7/proxy?url=' +
                                                encodeURIComponent(
                                                    urlCompleta
                                                ) +
                                                '"'
                                            );
                                        }
                                    );
                                }

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

                const playlistFinal =
                    nuevasLineas.join('\n');

                res.setHeader(
                    'Content-Type',
                    'application/vnd.apple.mpegurl'
                );

                res.setHeader(
                    'Cache-Control',
                    'no-cache, no-store, must-revalidate'
                );

                return res.send(
                    playlistFinal
                );
            }

            const tipo =
                response.headers[
                    'content-type'
                ] || 'video/mp2t';

            res.setHeader(
                'Content-Type',
                tipo
            );

            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );

            return res.send(
                Buffer.from(
                    response.data
                )
            );

        } catch (error) {

            console.error(
                'ERROR PROXY CANAL 7:',
                error.message
            );

            return res.status(502).send(
                'Error obteniendo Canal 7'
            );
        }
    }
);


// ======================================================
// STREAM PRINCIPAL CANAL 7
// ======================================================

app.get(
    '/api/canal7',
    async (req, res) => {

        console.log(
            'Roku solicitó Canal 7'
        );

        const playlist =
            await obtenerPlaylistCanal7(
                CANAL7_MASTER
            );

        if (!playlist) {

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
                await Promise.all(
                    vigentes.map(
                        async canal => {

                            const c = {
                                ...canal
                            };

                            if (
                                c.telemicro_web
                            ) {

                                console.log(
                                    'Buscando nueva sesión de Telemicro...'
                                );

                                c.url =
                                    'https://oku-backend-rd.onrender.com/api/telemicro';
                            }

                            return c;
                        }
                    )
                );

            res.json(
                resultados
            );

        } catch (error) {

            console.error(
                'Error general en backend:',
                error.message
            );

            res.status(500).json(
                {
                    error:
                        'Error al procesar la lista de canales'
                }
            );
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
// INICIAR SERVIDOR
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            `Servidor activo en el puerto ${PORT}`
        );
    }
);
