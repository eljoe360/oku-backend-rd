const express = require('express');
const { obtenerUrlCanal } = require('./extractor');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Ruta base de estado
app.get('/', (req, res) => {
  res.send('Servidor de Roku activo y listo.');
});

// Endpoint de extracción directa para Telesistema 11
app.get('/live/telesistema', async (req, res) => {
  console.log('=== Iniciando extracción completa de Telesistema ===');
  
  // Lista de URLs posibles del canal por si la portada redirige
  const urlsAProbar = [
    'https://telesistema11.com.do/en-vivo',
    'https://telesistema11.com.do/'
  ];

  let streamUrl = null;

  for (const url of urlsAProbar) {
    console.log(`Probando en: ${url}`);
    streamUrl = await obtenerUrlCanal(url);
    if (streamUrl) break;
  }

  if (streamUrl) {
    console.log('¡Éxito! Redirigiendo a:', streamUrl);
    res.redirect(streamUrl);
  } else {
    console.log('Fallaron todas las vías de extracción.');
    res.status(500).json({ error: 'No se pudo capturar el enlace M3U8.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
