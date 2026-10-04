const express = require('express');
const { obtenerUrlCanal } = require('./extractor');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Ruta principal de prueba
app.get('/', (req, res) => {
  res.send('Servidor activo');
});

// Ruta dinámica para extraer y redirigir al flujo M3U8 de Telesistema
app.get('/live/telesistema', async (req, res) => {
  console.log('Obteniendo señal de Telesistema...');
  const urlCanal = 'https://telesistema11.com.do/';
  
  const streamUrl = await obtenerUrlCanal(urlCanal);

  if (streamUrl) {
    // Redirige la petición al flujo directo para que Roku o el reproductor lo abra
    res.redirect(streamUrl);
  } else {
    res.status(500).json({ error: 'No se pudo obtener la transmisión en vivo.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
