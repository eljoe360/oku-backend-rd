const express = require('express');
const { obtenerUrlCanal } = require('./extractor');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Ruta principal para verificar que el servidor funciona
app.get('/', (req, res) => {
  res.send('Servidor de Roku activo y listo.');
});

// Ruta de extracción dinámica para Telesistema
app.get('/live/telesistema', async (req, res) => {
  console.log('Iniciando extracción de Telesistema...');
  const urlCanal = 'https://telesistema11.com.do/';
  
  try {
    const streamUrl = await obtenerUrlCanal(urlCanal);

    if (streamUrl) {
      console.log('Redirigiendo a:', streamUrl);
      res.redirect(streamUrl);
    } else {
      res.status(500).json({ error: 'No se pudo capturar el enlace M3U8.' });
    }
  } catch (error) {
    console.error('Error en el endpoint:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
