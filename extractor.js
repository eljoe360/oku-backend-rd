const puppeteer = require('puppeteer');

async function obtenerUrlCanal(urlPagina) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });

    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let streamUrl = null;

    // Capturar cualquier petición de red que tenga m3u8, mpd o playlist
    page.on('request', request => {
      const reqUrl = request.url();
      if ((reqUrl.includes('.m3u8') || reqUrl.includes('playlist') || reqUrl.includes('manifest')) && !streamUrl) {
        // Filtrar archivos estáticos irrelevantes
        if (!reqUrl.endsWith('.js') && !reqUrl.endsWith('.css')) {
          streamUrl = reqUrl;
          console.log('¡Enlace capturado!:', streamUrl);
        }
      }
    });

    await page.goto(urlPagina, { waitUntil: 'networkidle2', timeout: 35000 });

    // Intentar hacer clic en reproductores de video o botones de play si existen
    try {
      const frames = page.frames();
      for (const frame of frames) {
        const videoElement = await frame.$('video');
        if (videoElement) {
          await videoElement.click();
        }
      }
    } catch (e) {
      // Ignorar si no requiere interacción
    }

    // Esperar unos segundos para permitir que empiece el flujo de red
    await new Promise(resolve => setTimeout(resolve, 6000));

    return streamUrl;
  } catch (error) {
    console.error('Error al extraer el canal:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { obtenerUrlCanal };
