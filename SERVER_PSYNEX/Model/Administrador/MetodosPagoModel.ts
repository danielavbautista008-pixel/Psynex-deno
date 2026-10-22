import { conexion } from "../conexion.ts";
import type {
  CrearMetodoPagoInput,
  ActualizarMetodoPagoInput,
} from "../../Validators/Administrador/MetodosPagoValidator.ts";

export const MetodosPagoModel = {
  async listar() {
    return await conexion.query(
      `SELECT MetodoPagoId, Nombre, EstadoActivo, CreadoEn
       FROM metodospago
       ORDER BY Nombre ASC`,
    );
  },

  async listarActivos() {
    return await conexion.query(
      `SELECT MetodoPagoId, Nombre
       FROM metodospago
       WHERE EstadoActivo = 1
       ORDER BY Nombre ASC`,
    );
  },

  async buscarPorId(id: string) {
    const rows = await conexion.query(
      `SELECT * FROM metodospago WHERE MetodoPagoId = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async crear(data: CrearMetodoPagoInput) {
    const id = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO metodospago (MetodoPagoId, Nombre, EstadoActivo, CreadoEn)
       VALUES (?, ?, ?, NOW())`,
      [id, data.nombre, data.estadoActivo ? 1 : 0],
    );
    return id;
  },

  async actualizar(id: string, data: ActualizarMetodoPagoInput) {
    const actual = await this.buscarPorId(id);
    if (!actual) return false;

    const campos: string[] = [];
    const valores: unknown[] = [];

    if (data.nombre !== undefined) {
      campos.push("Nombre = ?");
      valores.push(data.nombre);
    }
    if (data.estadoActivo !== undefined) {
      campos.push("EstadoActivo = ?");
      valores.push(data.estadoActivo ? 1 : 0);
    }
    if (!campos.length) return true;

    valores.push(id);
    await conexion.execute(
      `UPDATE metodospago SET ${campos.join(", ")} WHERE MetodoPagoId = ?`,
      valores,
    );
    return true;
  },

  async eliminar(id: string) {
    // Soft delete: desactivar (por si hay pagos que lo referencian)
    await conexion.execute(
      `UPDATE metodospago SET EstadoActivo = 0 WHERE MetodoPagoId = ?`,
      [id],
    );
    return true;
  },
};