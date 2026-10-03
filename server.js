const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================
// CANAL 6 - EL SEIS
// HLS ADAPTATIVO
// ======================================================
const CANAL6 = 'https://stream.elseis.do/canal6/master.m3u8';

// ======================================================
// PÁGINA PRINCIPAL
// ======================================================
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Servidor TV</title>
            </head>
            <body>
                <h1>Servidor funcionando</h1>
                <p>Canal 6 disponible</p>
                <p>
                    <a href="/canal6.m3u8">
                        Ver Canal 6
                    </a>
                </p>
            </body>
        </html>
    `);
});

// ======================================================
// CANAL 6
// REDIRECCIÓN AL STREAM ADAPTATIVO ORIGINAL
// ======================================================
app.get('/canal6.m3u8', (req, res) => {
    res.redirect(302, CANAL6);
});

// ======================================================
// TAMBIÉN PERMITIMOS /canal6
// ======================================================
app.get('/canal6', (req, res) => {
    res.redirect(302, CANAL6);
});

// ======================================================
// COMPROBAR QUE RENDER ESTÁ FUNCIONANDO
// ======================================================
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ======================================================
// INICIAR SERVIDOR
// ======================================================
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
