# 🎁 Sistema de Whitelist - Instrucciones

## 📋 Pasos para configurar

### 1. Crear la tabla en MySQL

Ejecuta el archivo SQL en tu base de datos:

```bash
mysql -u root -p supabase < whitelist-table.sql
```

O copia y pega el contenido de `whitelist-table.sql` en tu cliente MySQL (phpMyAdmin, MySQL Workbench, etc.)

### 2. Configurar contraseña del admin

En el archivo `.env`, cambia la contraseña:

```env
ADMIN_PASSWORD=TuPasswordSeguro123
```

### 3. Reiniciar el servidor

```bash
node server.js
```

### 4. Acceder al panel

Abre en tu navegador:

```
https://srv1090335.hstgr.cloud/admin/whitelist
```

Ingresa la contraseña que configuraste en el `.env`

## 🎯 Funcionalidades

- ✅ Ver todas las tiendas whitelisted
- ✅ Agregar nuevas tiendas
- ✅ Eliminar tiendas del whitelist
- ✅ Las tiendas whitelisted tienen acceso gratuito automáticamente
- ✅ Si una tienda ya instaló la app, se actualiza a plan gratuito al agregarla al whitelist

## 🔐 Seguridad

- El panel requiere contraseña para acceder
- Solo tú puedes agregar/eliminar tiendas
- La contraseña se configura en el `.env`

## 📝 Notas

- Las tiendas deben terminar en `.myshopify.com`
- Puedes agregar una razón opcional (ej: "Cliente VIP", "Prueba", etc.)
- Las tiendas actuales del código ya están migradas a la BD
