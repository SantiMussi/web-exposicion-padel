<?php
// API de cupos.
//   GET  api.php                                   → { "ocupados": { "2026-10-09-1900": 12, ... } }
//   POST api.php  { "turno": "...", "anterior": "..." }  → { "ok": true } | 409 { "error": "lleno" }
//   POST api.php  { "accion": "baja", "turno": "..." }   → { "ok": true }
//
// La tabla `turnos` se crea sola la primera vez.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$cfg = require __DIR__ . '/api-config.php';

function responder(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function turnoValido(string $id, array $cfg): bool
{
    // AAAA-MM-DD-HHMM con una hora habilitada
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})-(\d{4})$/', $id, $m)) return false;
    if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1])) return false;
    return in_array($m[4], $cfg['horas'], true);
}

try {
    $db = new PDO(
        "mysql:host={$cfg['db_host']};dbname={$cfg['db_nombre']};charset=utf8mb4",
        $cfg['db_usuario'],
        $cfg['db_clave'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $db->exec('CREATE TABLE IF NOT EXISTS turnos (
        id VARCHAR(20) PRIMARY KEY,
        ocupados INT NOT NULL DEFAULT 0
    )');
} catch (Throwable $e) {
    error_log('padel api: ' . $e->getMessage());
    responder(500, ['error' => 'db']);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $ocupados = [];
    foreach ($db->query('SELECT id, ocupados FROM turnos') as $fila) {
        $ocupados[$fila['id']] = (int) $fila['ocupados'];
    }
    responder(200, ['ocupados' => (object) $ocupados]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(405, ['error' => 'metodo']);
}

$datos = json_decode(file_get_contents('php://input'), true) ?: [];
$turno = (string) ($datos['turno'] ?? '');
$anterior = (string) ($datos['anterior'] ?? '');

if (!turnoValido($turno, $cfg)) responder(400, ['error' => 'turno']);

// Desinscribirse: libera el lugar.
if (($datos['accion'] ?? '') === 'baja') {
    try {
        $db->prepare('UPDATE turnos SET ocupados = ocupados - 1 WHERE id = ? AND ocupados > 0')
            ->execute([$turno]);
        responder(200, ['ok' => true]);
    } catch (Throwable $e) {
        error_log('padel api: ' . $e->getMessage());
        responder(500, ['error' => 'db']);
    }
}
if ($anterior !== '' && !turnoValido($anterior, $cfg)) $anterior = '';

// Sin transacción a propósito: cada UPDATE es atómico por sí solo, y así no hay
// deadlocks cuando muchos se anotan al mismo turno a la vez.
try {
    $db->prepare('INSERT IGNORE INTO turnos (id, ocupados) VALUES (?, 0)')->execute([$turno]);

    // Suma 1 sólo si hay lugar. MySQL bloquea la fila mientras evalúa, así que
    // aunque lleguen 50 pedidos juntos, nunca pasa del cupo.
    $sumar = $db->prepare('UPDATE turnos SET ocupados = ocupados + 1 WHERE id = ? AND ocupados < ?');
    $sumar->execute([$turno, $cfg['cupo']]);
    if ($sumar->rowCount() === 0) responder(409, ['error' => 'lleno']);

    // Si se cambió de horario, libera el lugar anterior.
    if ($anterior !== '' && $anterior !== $turno) {
        $db->prepare('UPDATE turnos SET ocupados = ocupados - 1 WHERE id = ? AND ocupados > 0')
            ->execute([$anterior]);
    }

    responder(200, ['ok' => true]);
} catch (Throwable $e) {
    error_log('padel api: ' . $e->getMessage());
    responder(500, ['error' => 'db']);
}
