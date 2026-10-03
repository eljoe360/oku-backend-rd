// ======================================================
// CANALES DESDE GITHUB (RESPETA NÚMEROS Y URLS)
// ======================================================
app.get('/api/canales', async (req, res) => {
    try {
        const response = await axios.get(GITHUB_JSON_URL, { timeout: 15000 });
        const canales = response.data;
        const ahora = new Date();

        const canalesValidos = canales.filter(canal => {
            if (!canal.vencimiento) return true;
            return new Date(canal.vencimiento) > ahora;
        });

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        const resultado = canalesValidos.map(canal => {
            const nuevo = { ...canal };

            // Si tiene bandera web, asigna el endpoint dinámico; si no, mantiene la url original
            if (canal.telemicro_web) {
                nuevo.url = `${baseUrl}/api/telemicro`;
            } else if (canal.canal6_web) {
                nuevo.url = `${baseUrl}/api/canal6`;
            } else if (canal.canal7_web) {
                nuevo.url = `${baseUrl}/api/canal7`;
            }

            return nuevo;
        });

        return res.json(resultado);
    } catch (error) {
        console.log('Error leyendo canales: ' + error.message);
        return res.status(500).json({ error: 'No se pudieron obtener los canales' });
    }
});
