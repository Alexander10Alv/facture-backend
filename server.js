require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
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
// WHITELIST DE TIENDAS GRATUITAS (Desde BD)
// ============================================
async function isWhitelisted(shop) {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM whitelist WHERE shop_domain = ?',
      [shop]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Error verificando whitelist:', error);
    return false;
  }
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
    const whitelisted = await isWhitelisted(shop);
    if (whitelisted) {
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

// ============================================
// PANEL DE ADMINISTRACIÓN - WHITELIST
// ============================================

// Función para obtener contraseña de la BD
async function getAdminPassword() {
  try {
    const [rows] = await pool.execute(
      'SELECT setting_value FROM admin_settings WHERE setting_key = ?',
      ['admin_password']
    );
    return rows.length > 0 ? rows[0].setting_value : null;
  } catch (error) {
    console.error('Error obteniendo contraseña:', error);
    return null;
  }
}

// Middleware de autenticación
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  const token = authHeader.substring(7);
  const storedPassword = await getAdminPassword();
  
  if (!storedPassword) {
    return res.status(500).json({ error: 'Error de configuración' });
  }
  
  // Comparar con bcrypt
  const isValid = await bcrypt.compare(token, storedPassword);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  
  next();
}

// Servir panel HTML
app.get('/admin/whitelist', (req, res) => {
  res.sendFile(__dirname + '/admin-panel.html');
});

// API: Listar tiendas whitelisted
app.get('/api/whitelist', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, shop_domain, reason, added_by, created_at, updated_at FROM whitelist ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error obteniendo whitelist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Agregar tienda a whitelist
app.post('/api/whitelist', requireAuth, async (req, res) => {
  try {
    const { shop_domain, reason } = req.body;
    
    if (!shop_domain) {
      return res.status(400).json({ success: false, error: 'shop_domain es requerido' });
    }
    
    // Validar formato
    if (!shop_domain.endsWith('.myshopify.com')) {
      return res.status(400).json({ 
        success: false, 
        error: 'El dominio debe terminar en .myshopify.com' 
      });
    }
    
    await pool.execute(
      'INSERT INTO whitelist (shop_domain, reason, added_by) VALUES (?, ?, ?)',
      [shop_domain, reason || 'Sin razón especificada', 'admin']
    );
    
    // Si la tienda ya existe en subscriptions, actualizar a plan gratuito
    await pool.execute(
      `UPDATE subscriptions 
       SET subscription_status = 'active', plan_type = 'free', updated_at = NOW()
       WHERE shop_domain = ?`,
      [shop_domain]
    );
    
    res.json({ success: true, message: 'Tienda agregada al whitelist' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'La tienda ya está en el whitelist' });
    }
    console.error('Error agregando a whitelist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Eliminar tienda de whitelist
app.delete('/api/whitelist/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener info de la tienda antes de eliminar
    const [whitelistRows] = await pool.execute(
      'SELECT shop_domain FROM whitelist WHERE id = ?',
      [id]
    );
    
    if (whitelistRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tienda no encontrada' });
    }
    
    const shopDomain = whitelistRows[0].shop_domain;
    
    // Eliminar del whitelist
    await pool.execute('DELETE FROM whitelist WHERE id = ?', [id]);
    
    // Verificar si la tienda tiene la app instalada
    const [shopRows] = await pool.execute(
      'SELECT access_token, subscription_status, plan_type FROM subscriptions WHERE shop_domain = ?',
      [shopDomain]
    );
    
    if (shopRows.length === 0 || !shopRows[0].access_token) {
      return res.json({ 
        success: true, 
        message: 'Tienda eliminada del whitelist (no tenía la app instalada)' 
      });
    }
    
    const { access_token, subscription_status, plan_type } = shopRows[0];
    
    // Verificar si tiene suscripción pagada activa
    const hasPaidSubscription = subscription_status === 'active' && plan_type === 'paid';
    
    if (hasPaidSubscription) {
      return res.json({ 
        success: true, 
        message: 'Tienda eliminada del whitelist. La app sigue instalada porque tiene suscripción pagada activa.' 
      });
    }
    
    // No tiene suscripción pagada → Desinstalar la app
    try {
      const revokeUrl = `https://${shopDomain}/admin/api_permissions/current.json`;
      
      const response = await fetch(revokeUrl, {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        // Limpiar access token de la BD
        await pool.execute(
          'UPDATE subscriptions SET access_token = NULL, subscription_status = "uninstalled", updated_at = NOW() WHERE shop_domain = ?',
          [shopDomain]
        );
        
        console.log(`✅ App desinstalada remotamente de ${shopDomain}`);
        
        return res.json({ 
          success: true, 
          message: 'Tienda eliminada del whitelist y app desinstalada. Si quieren reinstalar, deberán suscribirse.' 
        });
      } else {
        console.warn(`⚠️ No se pudo desinstalar app de ${shopDomain}: ${response.status}`);
        return res.json({ 
          success: true, 
          message: 'Tienda eliminada del whitelist pero no se pudo desinstalar la app automáticamente. Desinstálala manualmente desde Shopify Admin.' 
        });
      }
    } catch (uninstallError) {
      console.error('Error desinstalando app:', uninstallError);
      return res.json({ 
        success: true, 
        message: 'Tienda eliminada del whitelist pero hubo un error al desinstalar la app. Desinstálala manualmente.' 
      });
    }
    
  } catch (error) {
    console.error('Error eliminando de whitelist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Cambiar contraseña del admin
app.post('/api/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren contraseña actual y nueva' 
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'La nueva contraseña debe tener al menos 8 caracteres' 
      });
    }
    
    // Verificar contraseña actual
    const storedPassword = await getAdminPassword();
    const isValid = await bcrypt.compare(currentPassword, storedPassword);
    
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Contraseña actual incorrecta' 
      });
    }
    
    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Actualizar en BD
    await pool.execute(
      'UPDATE admin_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
      [hashedPassword, 'admin_password']
    );
    
    console.log('✅ Contraseña de admin actualizada');
    
    res.json({ 
      success: true, 
      message: 'Contraseña actualizada exitosamente' 
    });
    
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
  console.log(`📍 URL: ${process.env.HOST}`);
  console.log(`🔐 Panel admin: ${process.env.HOST}/admin/whitelist`);
});
