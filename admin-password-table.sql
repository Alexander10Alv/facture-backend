-- Tabla para guardar la contraseña del admin
CREATE TABLE IF NOT EXISTS `admin_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar contraseña por defecto (hasheada con bcrypt)
-- Contraseña: MiPasswordSeguro2024
INSERT INTO `admin_settings` (`setting_key`, `setting_value`) VALUES
('admin_password', '$2b$10$rZ8qH5vX9YwJ3K2mN1pLxOXxGzQwE4tY6uV8sA7bC9dF0eG1hI2jK')
ON DUPLICATE KEY UPDATE updated_at = NOW();
