<?php
// Datos de la base MySQL: hPanel > Bases de datos > Administración.
// Tienen que coincidir con config.js: mismo cupo y mismas horas (sin los dos puntos).
return [
    'db_host'    => 'localhost',
    'db_nombre'  => 'REEMPLAZAR',   // ej: u123456789_padel
    'db_usuario' => 'REEMPLAZAR',   // ej: u123456789_padel
    'db_clave'   => 'REEMPLAZAR',

    'cupo'  => 30,
    'horas' => ['1900', '2000', '2100'],
    'max_acompanantes' => 3,

    // Clave para ver la lista de inscriptos en admin.html (nombres y teléfonos).
    'admin_clave' => 'REEMPLAZAR',
];
