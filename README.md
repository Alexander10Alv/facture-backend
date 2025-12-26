# Facture Backend - Sistema de Monetización

Backend para gestionar suscripciones de pago de la app Facture Extension.

## Configuración

1. Instalar dependencias:
```bash
npm install
```

2. Configurar `.env`:
- Agregar tu `SHOPIFY_API_SECRET`
- Verificar credenciales de MySQL

3. Crear tabla en MySQL:
```sql
-- Ya ejecutado en phpMyAdmin
```

4. Iniciar servidor:
```bash
npm start
```

## Endpoints

- `GET /health` - Health check
- `GET /test-db` - Test conexión BD
- `GET /install` - Iniciar instalación
- `GET /callback` - Callback OAuth
- `GET /charge-callback` - Confirmar cargo
- `GET /check-subscription` - Verificar suscripción (para extensions)
- `POST /webhooks/app-uninstalled` - Webhook desinstalación
- `POST /webhooks/subscription-update` - Webhook actualización suscripción

## Testing Local

```bash
# Test health
curl http://localhost:3000/health

# Test BD
curl http://localhost:3000/test-db

# Test suscripción
curl "http://localhost:3000/check-subscription?shop=test.myshopify.com"
```

## Deployment

Subir a VPS con PM2 o similar.
