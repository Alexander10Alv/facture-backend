-- Tabla para gestionar tiendas whitelisted (acceso gratuito)
CREATE TABLE IF NOT EXISTS `whitelist` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `shop_domain` varchar(255) NOT NULL,
  `reason` varchar(255) DEFAULT NULL COMMENT 'Razón del acceso gratuito (ej: cliente VIP, prueba, etc)',
  `added_by` varchar(100) DEFAULT 'admin' COMMENT 'Quién agregó la tienda',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `shop_domain` (`shop_domain`),
  KEY `idx_shop_domain` (`shop_domain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar las tiendas actuales del código
INSERT INTO `whitelist` (`shop_domain`, `reason`, `added_by`) VALUES
('systemperuplus.myshopify.com', 'Tienda de prueba', 'system'),
('integration-lioren.myshopify.com', 'Cliente inicial', 'system')
ON DUPLICATE KEY UPDATE updated_at = NOW();
