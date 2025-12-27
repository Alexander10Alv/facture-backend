require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { shopifyApi, LATEST_API_VERSION } = require('@shopify/shopify-api');
require('@shopify/shopify-api/adapters/node');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar pool de conexiones MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Configurar Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES.split(','),
  hostName: process.env.HOST.replace(/https?:\/\//, ''),
  apiVersion: process.env.SHOPIFY_API_VERSION || LATEST_API_VERSION,
  isEmbeddedApp: false,
});

// Middlewares
app.use(cors());
app.use(express.json());

// ============================================
// ENDPOINT 1: INSTALACIÓN (Crear cargo)
// ============================================
// ENDPOINT 1: INSTALACIÓN (Crear cargo)
// ============================================
app.get('/install', async (req, res) => {
  console.log('🚀🚀🚀 INSTALL RECIBIDO');
  console.log('Query params:', req.query);
  
  const { shop } = req.query;
  
  if (!shop) {
    console.log('❌ Falta parámetro shop');
    return res.status(400).send('Falta parámetro shop');
  }

  try {
    console.log('Iniciando auth para shop:', shop);
    
    // Con el adapter de Node, auth.begin hace el redirect automáticamente
    await shopify.auth.begin({
      shop,
      callbackPath: '/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
    
    console.log('✅ Redirect enviado por Shopify API');
    
  } catch (error) {
    console.error('❌❌❌ ERROR EN INSTALL:', error);
    console.error('Stack:', error.stack);
    res.status(500).send('Error al instalar app');
  }
});

// ============================================
// WHITELIST DE TIENDAS GRATUITAS
// ============================================
const WHITELIST = [
  'systemperuplus.myshopify.com', // Tu tienda de prueba
  'integration-lioren.myshopify.com', // Tienda del cliente
  // Agrega más tiendas aquí
];

function isWhitelisted(shop) {
  return WHITELIST.includes(shop);
}

// ============================================
// ENDPOINT 2: CALLBACK (Verificar instalación)
// ============================================
app.get('/callback', async (req, res) => {
  console.log('🔥🔥🔥 CALLBACK RECIBIDO');
  console.log('Query params:', req.query);
  
  try {
    console.log('Iniciando auth callback...');
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;
    const { shop, accessToken } = session;
    
    console.log('✅ Auth exitoso para shop:', shop);
    console.log('Access token obtenido:', accessToken ? 'SÍ' : 'NO');

    // Guardar access token en BD
    await pool.execute(
      `INSERT INTO subscriptions (shop_domain, access_token, subscription_status, plan_type, created_at, updated_at)
       VALUES (?, ?, 'pending', 'unknown', NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
       access_token = VALUES(access_token),
       updated_at = NOW()`,
      [shop, accessToken]
    );
    
    console.log('✅ Access token guardado en BD');

    // ============================================
    // VERIFICAR WHITELIST
    // ============================================
    if (isWhitelisted(shop)) {
      console.log('🎁 Tienda en WHITELIST - Acceso gratuito');
      
      // Actualizar como plan gratuito
      await pool.execute(
        `UPDATE subscriptions 
         SET subscription_status = 'active', plan_type = 'free', updated_at = NOW()
         WHERE shop_domain = ?`,
        [shop]
      );
      
      console.log('✅ Guardado como plan gratuito');
      
      // Redirigir al admin de la app
      return res.redirect(`https://${shop}/admin/apps`);
    }

    // ============================================
    // MANAGED PRICING - Redirigir a página de Shopify
    // ============================================
    
    // Extraer store handle (ejemplo: "atlastshop-2" de "atlastshop-2.myshopify.com")
    const storeHandle = shop.replace('.myshopify.com', '');
    
    // App handle (slug de la app, no el ID numérico)
    const appHandle = 'facture-extension';
    
    // URL de la página de selección de planes (hosteada por Shopify)
    const pricingUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
    
    console.log(`🔄 Redirigiendo a página de pricing: ${pricingUrl}`);
    
    // Redirigir al comerciante para que elija un plan
    return res.redirect(pricingUrl);
  
  } catch (error) {
    console.error('❌❌❌ ERROR EN CALLBACK:', error);
    console.error('Stack:', error.stack);
    res.status(500).send('Error al procesar instalación');
  }
});

// ============================================
// ENDPOINT 3: WEBHOOK - Suscripción Actualizada (Managed Pricing)
// ============================================
// Con Managed Pricing, Shopify envía webhooks cuando cambia la suscripción
app.post('/webhooks/subscription-update', express.raw({ type: 'application/json' }), async (req, res) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const body = req.body;

  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  if (hash !== hmac) {
    return res.status(401).send('HMAC inválido');
  }

  const data = JSON.parse(body.toString());
  const status = data.app_subscription.status;
  const shop = data.app_subscription.shop_domain;

  await pool.execute(
    'UPDATE subscriptions SET subscription_status = ?, updated_at = NOW() WHERE shop_domain = ?',
    [status, shop]
  );

  console.log(`Suscripción actualizada: ${shop} - ${status}`);
  res.status(200).send('OK');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test DB connection
app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 + 1 AS result');
    res.json({ success: true, result: rows[0].result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
  console.log(`📍 URL: ${process.env.HOST}`);
});
