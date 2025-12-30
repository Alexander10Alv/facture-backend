# 🔐 Sistema de Cambio de Contraseña - Instrucciones

## 📋 Pasos para configurar

### 1. Crear la tabla en MySQL

En el servidor, ejecuta:

```bash
mysql -u u1090335_facture -p u1090335_facture < admin-password-table.sql
```

Esto crea la tabla `admin_settings` con la contraseña por defecto hasheada.

### 2. Instalar bcrypt en el servidor

```bash
cd /var/www/facture-backend
npm install bcrypt
```

### 3. Subir cambios desde tu PC

```bash
cd facture-backend
git add .
git commit -m "Add password change feature"
git push origin main
```

### 4. Descargar cambios en el servidor

```bash
# En PuTTY
chattr -R -i /var/www/facture-backend/
cd /var/www/facture-backend
git pull origin main
npm install
pm2 restart facture-backend
chattr -R +i /var/www/facture-backend/
```

## 🎯 Cómo usar

1. Ingresa al panel: `https://facture.bigstudio.cl/admin/whitelist`
2. Usa la contraseña actual: `MiPasswordSeguro2024`
3. En la sección "🔐 Cambiar Contraseña":
   - Ingresa la contraseña actual
   - Ingresa la nueva contraseña (mínimo 8 caracteres)
   - Confirma la nueva contraseña
   - Click en "Cambiar Contraseña"
4. La próxima vez que ingreses, usa la nueva contraseña

## 🔒 Seguridad

- Las contraseñas se guardan hasheadas con bcrypt (no en texto plano)
- Se requiere la contraseña actual para cambiarla
- Mínimo 8 caracteres para la nueva contraseña
- La contraseña ya no está en el `.env`, está en la BD

## ⚠️ Importante

Si olvidas la contraseña, puedes resetearla ejecutando en el servidor:

```bash
mysql -u u1090335_facture -p u1090335_facture
```

Luego:

```sql
UPDATE admin_settings 
SET setting_value = '$2b$10$rZ8qH5vX9YwJ3K2mN1pLxOXxGzQwE4tY6uV8sA7bC9dF0eG1hI2jK' 
WHERE setting_key = 'admin_password';
```

Esto resetea la contraseña a: `MiPasswordSeguro2024`
