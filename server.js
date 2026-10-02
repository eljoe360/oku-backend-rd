```javascript
const express = require('express');
const axios = require('axios');

const app = express();

const PORT = process.env.PORT || 3000;


// ======================================================
// GITHUB - LISTA DE CANALES
// ======================================================

const GITHUB_JSON_URL =
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';


// ======================================================
// ===================== TELEMICRO =======================
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
                .map(c => c.split(';')[0])
                .join('; ');
        }

    } catch (error) {

        console.log(
            'No se pudieron obtener cookies de Telemicro:',
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

            validateStatus: () => true
        }
    );


    if (playlistRes.status !== 200) {

        throw new Error(
            `Telemicro respondió HTTP ${playlistRes.status}`
        );
    }


    const playlist = playlistRes.data;


    const lineas = playlist
        .split(/\r?\n/)
        .map(x => x.trim())
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
        'Stream Telemicro encontrado:',
        streamUrl
    );


    return {
        streamUrl,
        cookies
    };
}


// ======================================================
// PLAYLIST TELEMICRO
// ======================================================

async function obtenerPlaylistTelemicro() {

    const datos = await obtenerStreamTelemicro();


    const response = await axios.get(
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


    const playlist = response.data;


    const baseUrl = new URL(
        datos.streamUrl
    );


    const lineas = playlist.split(/\r?\n/);


    const resultado = [];


    for (const linea of lineas) {

        const texto = linea.trim();


        if (!texto) {

            resultado.push('');

            continue;
        }


        if (texto.startsWith('#')) {

            resultado.push(texto);

            continue;
        }


        const urlSegmento = new URL(
            texto,
            baseUrl
        ).href;


        const proxy =
            `/api/telemicro/proxy?url=${encodeURIComponent(urlSegmento)}&cookie=${encodeURIComponent(datos.cookies)}`;


        resultado.push(proxy);
    }


    return resultado.join('\n');
}


// ======================================================
// PROXY TELEMICRO
// ======================================================

app.get(
    '/api/telemicro/proxy',
    async (req, res) => {

        try {

            const url = req.query.url;
            const cookie = req.query.cookie || '';


            if (!url) {

                return res
                    .status(400)
                    .send('Falta URL');
            }


            const response = await axios.get(
                url,
                {
                    responseType: 'arraybuffer',

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


            return res.end(
                Buffer.from(response.data)
            );

        } catch (error) {

            console.log(
                'Error proxy Telemicro:',
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
    async (req, res) => {

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
                'Error Telemicro:',
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
// ======================= CANAL 6 =======================
// ======================================================

const CANAL6_MASTER =
    'https://stream.elseis.do/canal6/master.m3u8';

const CANAL6_HOST =
    'https://stream.elseis.do';


async function obtenerPlaylistCanal6() {

    const response = await axios.get(
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
            new URL(texto, baseUrl).href;


        const proxy =
            `/api/canal6/proxy?url=${encodeURIComponent(url)}`;


        resultado.push(proxy);
    }


    return resultado.join('\n');
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

                        maxRedirects:
```
