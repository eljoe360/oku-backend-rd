const express = require('express');
const axios = require('axios');

const app = express();

const PORT = process.env.PORT || 3000;


// ======================================================
// GITHUB
// ======================================================

const GITHUB_JSON_URL =
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';


// ======================================================
// TELEMICRO
// ======================================================

const TELEMICRO_PLAYLIST =
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

const TELEMICRO_BASE =
    'https://live2.telemicro.com.do/live/55/';


async function obtenerStreamTelemicro() {

    console.log('Obteniendo stream de Telemicro...');

    let cookies = '';

    try {

        const pagina = await axios.get(
            'https://telemicro.com.do/telemicro-en-vivo/',
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 20000
            }
        );

        if (pagina.headers['set-cookie']) {

            cookies = pagina.headers['set-cookie']
                .map(function(c) {
                    return c.split(';')[0];
                })
                .join('; ');
        }

    } catch (error) {

        console.log(
            'No se pudieron obtener cookies de Telemicro: ' +
            error.message
        );
    }


    const playlistRes = await axios.get(
        TELEMICRO_PLAYLIST,
        {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                'Referer':
                    'https://telemicro.com.do/',

                'Accept':
                    '*/*',

                'Cookie':
                    cookies
            },

            timeout: 20000,

            validateStatus: function() {
                return true;
            }
        }
    );


    if (playlistRes.status !== 200) {

        throw new Error(
            'Telemicro respondió HTTP ' +
            playlistRes.status
        );
    }


    const playlist = playlistRes.data;

    const lineas = playlist
        .split(/\r?\n/)
        .map(function(x) {
            return x.trim();
        })
        .filter(Boolean);


    let streamUrl = null;


    for (const linea of lineas) {

        if (
            linea.includes('chunks.m3u8') ||
            linea.includes('nimblesessionid')
        ) {

            streamUrl = new URL(
                linea,
                TELEMICRO_BASE
            ).href;

            break;
        }
    }


    if (!streamUrl) {

        throw new Error(
            'No se encontró el stream dinámico de Telemicro'
        );
    }


    console.log(
        'Stream Telemicro encontrado: ' +
        streamUrl
    );


    return {
        streamUrl: streamUrl,
        cookies: cookies
    };
}


// ======================================================
// PLAYLIST TELEMICRO
// ======================================================

async function obtenerPlaylistTelemicro() {

    const datos =
        await obtenerStreamTelemicro();


    const response =
        await axios.get(
            datos.streamUrl,
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                    'Referer':
                        'https://telemicro.com.do/',

                    'Accept':
                        '*/*',

                    'Cookie':
                        datos.cookies
                },

                timeout: 20000
            }
        );


    const playlist =
        response.data;


    const baseUrl =
        new URL(datos.streamUrl);


    const lineas =
        playlist.split(/\r?\n/);


    const resultado = [];


    for (const linea of lineas) {

        const texto =
            linea.trim();


        if (!texto) {

            resultado.push('');

            continue;
        }


        if (texto.startsWith('#')) {

            resultado.push(texto);

            continue;
        }


        const urlSegmento =
            new URL(
                texto,
                baseUrl
            ).href;


        const proxy =
            '/api/telemicro/proxy?url=' +
            encodeURIComponent(urlSegmento) +
            '&cookie=' +
            encodeURIComponent(datos.cookies);


        resultado.push(proxy);
    }


    return resultado.join('\n');
}


// ======================================================
// PROXY TELEMICRO
// ======================================================

app.get(
    '/api/telemicro/proxy',
    async function(req, res) {

        try {

            const url =
                req.query.url;

            const cookie =
                req.query.cookie || '';


            if (!url) {

                return res
                    .status(400)
                    .send('Falta URL');
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

                            'Referer':
                                'https://telemicro.com.do/',

                            'Accept':
                                '*/*',

                            'Cookie':
                                cookie
                        },

                        timeout: 30000,

                        maxRedirects: 10
                    }
                );


            res.setHeader(
                'Content-Type',
                'video/mp2t'
            );

            res.setHeader(
                'Cache-Control',
                'no-cache'
            );


            return res.send(
                response.data
            );

        } catch (error) {

            console.log(
                'Error proxy Telemicro: ' +
                error.message
            );


            return res
                .status(502)
                .send(
                    'Error obteniendo segmento de Telemicro'
                );
        }
    }
);


// ======================================================
// ENDPOINT TELEMICRO
// ======================================================

app.get(
    '/api/telemicro',
    async function(req, res) {

        try {

            console.log(
                'Roku solicitó Telemicro'
            );


            const playlist =
                await obtenerPlaylistTelemicro();


            res.setHeader(
                'Content-Type',
                'application/vnd.apple.mpegurl'
            );

            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );


            return res.send(
                playlist
            );

        } catch (error) {

            console.log(
                'Error Telemicro: ' +
                error.message
            );


            return res
                .status(502)
                .send(
                    'Error obteniendo Telemicro'
                );
        }
    }
);


// ======================================================
// CANAL 6
// ======================================================

const CANAL6_MASTER =
    'https://stream.elseis.do/canal6/master.m3u8';

const CANAL6_HOST =
    'https://stream.elseis.do';


async function obtenerPlaylistCanal6() {

    const response =
        await axios.get(
            CANAL6_MASTER,
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                    'Accept':
                        '*/*'
                },

                timeout: 20000
            }
        );


    const playlist =
        response.data;


    const baseUrl =
        new URL(CANAL6_MASTER);


    const lineas =
        playlist.split(/\r?\n/);


    const resultado = [];


    for (const linea of lineas) {

        const texto =
            linea.trim();


        if (!texto) {

            resultado.push('');

            continue;
        }


        if (texto.startsWith('#')) {

            resultado.push(texto);

            continue;
        }


        const url =
            new URL(
                texto,
                baseUrl
            ).href;


        const proxy =
            '/api/canal6/proxy?url=' +
            encodeURIComponent(url);


        resultado.push(proxy);
    }


    return resultado.join('\n');
}


// ======================================================
// PROXY CANAL 6
// ======================================================

app.get(
    '/api/canal6/proxy',
    async function(req, res) {

        try {

            const url =
                req.query.url;


            if (!url) {

                return res
                    .status(400)
                    .send('Falta URL');
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
                                '*/*'
                        },

                        timeout: 30000,

                        maxRedirects: 10
                    }
                );


            const contentType =
                response.headers['content-type'] || '';


            if (
                contentType.includes('mpegurl') ||
                contentType.includes('m3u8') ||
                url.includes('.m3u8')
            ) {

                const playlist =
                    Buffer
                        .from(response.data)
                        .toString('utf8');


                const baseUrl =
                    new URL(url);


                const lineas =
                    playlist.split(/\r?\n/);


                const resultado = [];


                for (const linea of lineas) {

                    const texto =
                        linea.trim();


                    if (!texto) {

                        resultado.push('');

                        continue;
                    }


                    if (texto.startsWith('#')) {

                        resultado.push(texto);

                        continue;
                    }


                    const nuevaUrl =
                        new URL(
                            texto,
                            baseUrl
                        ).href;


                    resultado.push(
                        '/api/canal6/proxy?url=' +
                        encodeURIComponent(nuevaUrl)
                    );
                }


                res.setHeader(
                    'Content-Type',
                    'application/vnd.apple.mpegurl'
                );


                return res.send(
                    resultado.join('\n')
                );
            }


            res.setHeader(
                'Content-Type',
                'video/mp2t'
            );

            res.setHeader(
                'Cache-Control',
                'no-cache'
            );


            return res.send(
                response.data
            );

        } catch (error) {

            console.log(
                'Error proxy Canal 6: ' +
                error.message
            );


            return res
                .status(502)
                .send(
                    'Error obteniendo segmento Canal 6'
                );
        }
    }
);


// ======================================================
// ENDPOINT CANAL 6
// ======================================================

app.get(
    '/api/canal6',
    async function(req, res) {

        try {

            console.log(
                'Roku solicitó Canal 6'
            );


            const playlist =
                await obtenerPlaylistCanal6();


            res.setHeader(
                'Content-Type',
                'application/vnd.apple.mpegurl'
            );

            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );


            return res.send(
                playlist
            );

        } catch (error) {

            console.log(
                'Error Canal 6: ' +
                error.message
            );


            return res
                .status(502)
                .send(
                    'Error obteniendo Canal 6'
                );
        }
    }
);


// ======================================================
// CANAL 7
// ======================================================

const CANAL7_MASTER =
    'https://d3gie3ig6argu.cloudfront.net/ts:abr.m3u8';

const CANAL7_HOST =
    'https://d3gie3ig6argu.cloudfront.net';


// ======================================================
// PLAYLIST CANAL 7
// ======================================================

async function obtenerPlaylistCanal7() {

    console.log(
        'Obteniendo playlist Canal 7...'
    );


    const response =
        await axios.get(
            CANAL7_MASTER,
            {
                responseType:
                    'text',

                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                    'Accept':
                        '*/*',

                    'Origin':
                        'https://teleantillas.com.do',

                    'Referer':
                        'https://teleantillas.com.do/',

                    'Accept-Language':
                        'es-DO,es;q=0.9,en;q=0.8'
                },

                timeout: 20000,

                maxRedirects: 10,

                validateStatus: function() {
                    return true;
                }
            }
        );


    console.log(
        'CANAL 7 MASTER HTTP: ' +
        response.status
    );


    if (
        response.status < 200 ||
        response.status >= 300
    ) {

        throw new Error(
            'Canal 7 respondió HTTP ' +
            response.status
        );
    }


    const playlist =
        response.data;


    const baseUrl =
        new URL(CANAL7_MASTER);


    const lineas =
        playlist.split(/\r?\n/);


    const resultado = [];


    for (const linea of lineas) {

        const texto =
            linea.trim();


        if (!texto) {

            resultado.push('');

            continue;
        }


        if (texto.startsWith('#')) {

            resultado.push(texto);

            continue;
        }


        const url =
            new URL(
                texto,
                baseUrl
            ).href;


        const proxy =
            '/api/canal7/proxy?url=' +
            encodeURIComponent(url);


        resultado.push(proxy);
    }


    return resultado.join('\n');
}


// ======================================================
// PROXY CANAL 7
// ======================================================

app.get(
    '/api/canal7/proxy',
    async function(req, res) {

        try {

            const url =
                req.query.url;


            if (!url) {

                return res
                    .status(400)
                    .send('Falta URL');
            }


            if (
                !url.startsWith(CANAL7_HOST)
            ) {

                return res
                    .status(403)
                    .send(
                        'URL no permitida'
                    );
            }


            console.log(
                'CANAL 7 PROXY: ' +
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

                            'Origin':
                                'https://teleantillas.com.do',

                            'Referer':
                                'https://teleantillas.com.do/',

                            'Accept-Language':
                                'es-DO,es;q=0.9,en;q=0.8'
                        },

                        timeout: 30000,

                        maxRedirects: 10,

                        validateStatus: function() {
                            return true;
                        }
                    }
                );


            console.log(
                'CANAL 7 HTTP: ' +
                response.status +
                ' SIZE: ' +
                response.data.length
            );


            if (
                response.status < 200 ||
                response.status >= 300
            ) {

                return res
                    .status(response.status)
                    .send(
                        'Canal 7 respondió HTTP ' +
                        response.status
                    );
            }


            const contentType =
                response.headers['content-type'] || '';


            // ==========================================
            // PLAYLIST M3U8 (Sub-playlist o Chunklist)
            // ==========================================

            if (
                contentType.includes('mpegurl') ||
                contentType.includes('m3u8') ||
                url.includes('.m3u8')
            ) {

                const playlist =
                    Buffer
                        .from(response.data)
                        .toString('utf8');


                const baseUrl =
                    new URL(url);


                const lineas =
                    playlist.split(/\r?\n/);


                const resultado = [];


                for (const linea of lineas) {

                    const texto =
                        linea.trim();


                    if (!texto) {

                        resultado.push('');

                        continue;
                    }


                    if (texto.startsWith('#')) {

                        resultado.push(texto);

                        continue;
                    }


                    const nuevaUrl =
                        new URL(
                            texto,
                            baseUrl
                        ).href;


                    resultado.push(
                        '/api/canal7/proxy?url=' +
                        encodeURIComponent(nuevaUrl)
                    );
                }


                res.setHeader(
                    'Content-Type',
                    'application/vnd.apple.mpegurl'
                );

                res.setHeader(
                    'Cache-Control',
                    'no-cache'
                );


                return res.send(
                    resultado.join('\n')
                );
            }


            // ==========================================
            // SEGMENTO TS (Video)
            // ==========================================

            res.setHeader(
                'Content-Type',
                'video/mp2t'
            );

            res.setHeader(
                'Cache-Control',
                'no-cache'
            );


            res.setHeader(
                'Content-Length',
                response.data.length
            );


            return res.send(
                response.data
            );

        } catch (error) {

            console.log(
                'ERROR PROXY CANAL 7: ' +
                error.message
            );


            return res
                .status(502)
                .send(
                    'Error obteniendo Canal 7'
                );
        }
    }
);


// ======================================================
// ENDPOINT CANAL 7
// ======================================================

app.get(
    '/api/canal7',
    async function(req, res) {

        try {

            console.log(
                'Roku solicitó Canal 7'
            );


            const playlist =
                await obtenerPlaylistCanal7();


            res.setHeader(
                'Content-Type',
                'application/vnd.apple.mpegurl'
            );


            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );


            return res.send(
                playlist
            );

        } catch (error) {

            console.log(
                'ERROR CANAL 7: ' +
                error.message
            );


            return res
                .status(502)
                .send(
                    'Error obteniendo Canal 7'
                );
        }
    }
);


// ======================================================
// CANALES DESDE GITHUB
// ======================================================

app.get(
    '/api/canales',
    async function(req, res) {

        try {

            const response =
                await axios.get(
                    GITHUB_JSON_URL,
                    {
                        timeout: 15000
                    }
                );


            const canales =
                response.data;


            const ahora =
                new Date();


            const canalesValidos =
                canales.filter(
                    function(canal) {

                        if (
                            !canal.vencimiento
                        ) {

                            return true;
                        }


                        return (
                            new Date(
                                canal.vencimiento
                            ) > ahora
                        );
                    }
                );


            const protocol =
                req.headers['x-forwarded-proto'] || req.protocol;

            const host =
                req.get('host');


            const resultado =
                canalesValidos.map(
                    function(canal) {

                        const nuevo =
                            Object.assign(
                                {},
                                canal
                            );


                        if (
                            canal.telemicro_web
                        ) {

                            nuevo.url =
                                protocol +
                                '://' +
                                host +
                                '/api/telemicro';
                        }


                        return nuevo;
                    }
                );


            return res.json(
                resultado
            );

        } catch (error) {

            console.log(
                'Error leyendo canales: ' +
                error.message
            );


            return res
                .status(500)
                .json({
                    error:
                        'No se pudieron obtener los canales'
                });
        }
    }
);


// ======================================================
// INICIO
// ======================================================

app.get(
    '/',
    function(req, res) {

        res.send(
            'OKU Backend RD funcionando'
        );
    }
);


// ======================================================
// SERVER
// ======================================================

app.listen(
    PORT,
    function() {

        console.log(
            'Servidor activo en el puerto ' +
            PORT
        );
    }
);
