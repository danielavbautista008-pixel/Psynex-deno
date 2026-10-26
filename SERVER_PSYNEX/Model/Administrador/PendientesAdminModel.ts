// =====================================================================
// cambio: ARCHIVO NUEVO — tareas pendientes del administrador (para la
// campanita). Solo cuenta lo que está esperando una acción suya; no cambia
// nada de las vistas ni de los modelos que ya existían.
// =====================================================================
import { conexion } from "../conexion.ts";

type Fila = Record<string, unknown>;

export const PendientesAdminModel = {
  async resumen() {
    const [f] = await conexion.query(
      `SELECT
         (SELECT COUNT(*)
            FROM perfilpsicologo p
            JOIN usuarios u ON u.UsuarioId = p.UsuarioId AND u.Rol = 'Psicologo'
            LEFT JOIN documentosverificacion d ON d.PerfilId = p.PerfilId
              AND d.CreadoEn = (SELECT MAX(d2.CreadoEn) FROM documentosverificacion d2 WHERE d2.PerfilId = p.PerfilId)
           WHERE (p.EstaVerificado = 0 OR p.EstaVerificado IS NULL)
             AND (d.EstadoVerificacion IS NULL OR d.EstadoVerificacion IN ('Pendiente', 'pendiente'))) AS Psicologos,
         (SELECT COUNT(*)
            FROM perfilempresa pe
            JOIN usuarios u ON u.UsuarioId = pe.UsuarioId AND u.Rol = 'Empresa'
           WHERE pe.EstaVerificada = 0) AS Empresas,
         (SELECT COUNT(*) FROM contratoscorporativos
           WHERE Estado = 'Pendiente' AND ComprobantePago IS NOT NULL AND ComprobantePago <> '') AS PagosEmpresas,
         (SELECT COUNT(*) FROM pagos WHERE (Pasarela = 'Manual' AND EstadoPago = 'Pendiente') OR EstadoPago = 'Reembolso') -- cambio: + devoluciones
           + (SELECT COUNT(*) FROM comprasplanes WHERE MetodoPago = 'Manual' AND Estado = 'Pendiente') AS PagosPacientes,
         (SELECT COUNT(*) FROM reclamospago WHERE Estado IN ('Abierto', 'EnRevision')) AS Reclamos`,
    ) as Fila[];

    const tareas = [
      { clave: "psicologos", texto: "Psicólogos por verificar", total: Number(f?.Psicologos ?? 0), ruta: "/Administrador/verificarpsicologos", icono: "bi-patch-check" },
      { clave: "empresas", texto: "Empresas por verificar", total: Number(f?.Empresas ?? 0), ruta: "/Administrador/verificarempresas", icono: "bi-building-check" },
      { clave: "pagosEmpresas", texto: "Pagos de empresas por revisar", total: Number(f?.PagosEmpresas ?? 0), ruta: "/Administrador/pagosempresas", icono: "bi-buildings" },
      { clave: "pagosPacientes", texto: "Pagos de pacientes por revisar", total: Number(f?.PagosPacientes ?? 0), ruta: "/Administrador/pagospacientes", icono: "bi-wallet2" },
      { clave: "reclamos", texto: "Reclamos de psicólogos por responder", total: Number(f?.Reclamos ?? 0), ruta: "/Administrador/reclamos", icono: "bi-chat-left-text" },
    ];
    return { total: tareas.reduce((s, t) => s + t.total, 0), tareas };
  },
};
