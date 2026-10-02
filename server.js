```javascript
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

const TELEMICRO_PAGE =
    'https://telemicro.com.do/telemicro-en-vivo/';

const TELEMICRO_PLAYLIST =
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

const TELEMICRO_BASE =
    'https://live2.telemicro.com.do/live/55/';


// ======================================================
// USER AGENT
// ======================================================

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';


// ======================================================
// VARIABLES PARA GUARDAR SESIÓN
// ======================================================

let telemicroCookies = '';

let ultimoStreamTelemicro = null;

let ultimaActualizacion = 0;


// ======================================================
// OBTENER COOKIES DE TELEMIRO
// ======================================================

async function obtenerCookiesTelemicro() {

    try {

        const response = await axios.get(
            TELEMICRO_PAGE,
            {
                headers: {
                    'User-Agent': USER_AGENT,

                    'Accept':
                        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },

                timeout: 15000,

                maxRedirects: 5,

                validateStatus: () => true
            }
        );


        const setCookie =
            response.headers['set-cookie'];


        if (setCookie && setCookie.length > 0) {

            telemicroCookies =
                setCookie
                    .map(cookie =>
                        cookie.split(';')[0]
                    )
                    .join('; ');

            console.log(
                'Cookies Telemicro: OBTENIDAS'
            );

        } else {

            console.log(
                'Cookies Telemicro: NINGUNA'
            );
        }


        return telemicroCookies;

    }

    catch (error) {

        console.error(
            'Error obteniendo cookies:',
            error.message
        );

        return telemicroCookies;
    }
}



// ======================================================
// OBTENER STREAM DINÁMICO DE TELEMIRO
// ======================================================

async function obtenerStreamTelemicro() {

    try {

        console.log(
            '=========================================='
        );

        console.log(
            'BUSCANDO NUEVA SESIÓN DE TELEMIRO'
        );

        console.log(
            '=========================================='
        );


        // ------------------------------------------------
        // 1. Obtener cookies
        // ------------------------------------------------

        await obtenerCookiesTelemicro();


        // ------------------------------------------------
        // 2. Pedir playlist principal
        // ------------------------------------------------

        const playlistRes =
            await axios.get(
                TELEMICRO_PLAYLIST,
                {
                    headers: {

                        'User-Agent':
                            USER_AGENT,

                        'Accept':
                            'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

                        'Referer':
                            TELEMICRO_PAGE,

                        'Origin':
                            'https://telemicro.com.do',

                        'Cookie':
                            telemicroCookies
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


        // ------------------------------------------------
        // 3. Verificar respuesta
        // ------------------------------------------------

        if (
            playlistRes.status < 200 ||
            playlistRes.status >= 300
        ) {

            throw new Error(
                `Telemicro respondió HTTP ${playlistRes.status}`
            );
        }


        // ------------------------------------------------
        // 4. Guardar cookies nuevas
        // ------------------------------------------------

        const nuevasCookies =
            playlistRes.headers['set-cookie'];


        if (
            nuevasCookies &&
            nuevasCookies.length > 0
        ) {

            const cookiesPlaylist =
                nuevasCookies
                    .map(cookie =>
                        cookie.split(';')[0]
                    )
                    .join('; ');


            if (telemicroCookies) {

                telemicroCookies +=
                    '; ' +
                    cookiesPlaylist;

            } else {

                telemicroCookies =
                    cookiesPlaylist;
            }
        }


        // ------------------------------------------------
        // 5. Convertir playlist a texto
        // ------------------------------------------------

        const playlist =
            typeof playlistRes.data === 'string'
                ? playlistRes.data
                : String(playlistRes.data);


        console.log(
            'Playlist recibida:'
        );

        console.log(
            playlist.substring(0, 1000)
        );


        // ------------------------------------------------
        // 6. Buscar chunks.m3u8
        // ------------------------------------------------

        const match =
            playlist.match(
                /(?:https?:\/\/[^"\s]+\/)?chunks\.m3u8(?:\?[^"\s]+)?/i
            );


        if (match && match[0]) {

            let streamUrl =
                match[0];


            // --------------------------------------------
            // URL absoluta
            // --------------------------------------------

            if (
                streamUrl.startsWith(
                    'http://'
                ) ||
                streamUrl.startsWith(
                    'https://'
                )
            ) {

                // Ya está completa

            }


            // --------------------------------------------
            // URL relativa comenzando /
            // --------------------------------------------

            else if (
                streamUrl.startsWith('/')
            ) {

                streamUrl =
                    'https://live2.telemicro.com.do' +
                    streamUrl;
            }


            // --------------------------------------------
            // chunks.m3u8?...
            // --------------------------------------------

            else {

                streamUrl =
                    TELEMICRO_BASE +
                    streamUrl;
            }


            console.log(
                'STREAM TELEMIRO ENCONTRADO:'
            );

            console.log(
                streamUrl
            );


            ultimoStreamTelemicro =
                streamUrl;

            ultimaActualizacion =
                Date.now();


            return streamUrl;
        }


        // ------------------------------------------------
        // 7. Buscar nimblesessionid
        // ------------------------------------------------

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
                'STREAM TELEMIRO POR SESSION ID:'
            );

            console.log(
                streamUrl
            );


            ultimoStreamTelemicro =
                streamUrl;

            ultimaActualizacion =
                Date.now();


            return streamUrl;
        }


        throw new Error(
            'No se encontró chunks.m3u8 ni nimblesessionid'
        );

    }

    catch (error) {

        console.error(
            'ERROR OBTENIENDO TELEMIRO:',
            error.message
        );

        return null;
    }
}



// ======================================================
// OBTENER STREAM VÁLIDO
// ======================================================

async function obtenerStreamActual() {

    // --------------------------------------------------
    // Si ya tenemos uno reciente, intentamos reutilizarlo
    // durante unos segundos.
    // --------------------------------------------------

    const ahora =
        Date.now();


    const edad =
        ahora -
        ultimaActualizacion;


    if (
        ultimoStreamTelemicro &&
        edad < 30000
    ) {

        return ultimoStreamTelemicro;
    }


    // --------------------------------------------------
    // Buscar uno nuevo
    // --------------------------------------------------

    return await obtenerStreamTelemicro();
}



// ======================================================
// VERIFICAR QUE UNA URL PERTENEZCA A TELEMIRO
// ======================================================

function esUrlTelemicro(url) {

    try {

        const parsed =
            new URL(url);


        return (
            parsed.hostname ===
                'live2.telemicro.com.do'
        );

    }

    catch {

        return false;
    }
}



// ======================================================
// CONVERTIR URL RELATIVA EN ABSOLUTA
// ======================================================

function convertirUrlAbsoluta(
    url,
    baseUrl
) {

    try {

        return new URL(
            url,
            baseUrl
        ).toString();

    }

    catch {

        return null;
    }
}



// ======================================================
// CREAR URL DEL PROXY
// ======================================================

function crearUrlProxy(url) {

    return (
        '/api/telemicro/proxy?url=' +
        encodeURIComponent(url)
    );
}



// ======================================================
// REESCRIBIR PLAYLIST HLS
// ======================================================

function reescribirPlaylist(
    playlist,
    baseUrl
) {

    let resultado =
        playlist;


    // --------------------------------------------------
    // Reescribir URI="..."
    //
    // Sirve para:
    // EXT-X-KEY
    // EXT-X-MAP
    // EXT-X-MEDIA
    // etc.
    // --------------------------------------------------

    resultado =
        resultado.replace(
            /URI="([^"]+)"/gi,
            (match, uri) => {

                const absoluta =
                    convertirUrlAbsoluta(
                        uri,
```
