import { conexion } from "../conexion.ts";
import type {
  ActualizarMetodoPagoInput,
  CrearMetodoPagoInput,
} from "../../Validators/Administrador/MetodosPagoValidator.ts";

// Resultado con error para el controlador: { error, status }
type Fallo = { error: string; status: number };

const ULTIMO_ACTIVO = "Debe quedar al menos un método de pago activo.";

export const MetodosPagoModel = {
  async listar() {
    return await conexion.query(
      `SELECT MetodoPagoId, Nombre, Descripcion, EstadoActivo, CreadoEn
       FROM metodospago
       ORDER BY EstadoActivo DESC, Nombre ASC`,
    );
  },

  // Los que ve el paciente al pagar
  async listarActivos() {
    return await conexion.query(
      `SELECT MetodoPagoId, Nombre, Descripcion
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

  // ¿Ya hay otro método con ese nombre? (sin importar mayúsculas)
  async nombreRepetido(nombre: string, menosId = "") {
    const [f] = await conexion.query(
      `SELECT 1 AS hay FROM metodospago WHERE LOWER(Nombre) = LOWER(?) AND MetodoPagoId <> ? LIMIT 1`,
      [nombre, menosId],
    );
    return Boolean(f);
  },

  async activos(): Promise<number> {
    const [f] = await conexion.query(`SELECT COUNT(*) AS n FROM metodospago WHERE EstadoActivo = 1`);
    return Number(f?.n ?? 0);
  },

  async crear(data: CrearMetodoPagoInput): Promise<{ id: string } | Fallo> {
    if (await this.nombreRepetido(data.nombre)) {
      return { error: "Ya existe un método con ese nombre.", status: 409 };
    }
    const id = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO metodospago (MetodoPagoId, Nombre, Descripcion, EstadoActivo, CreadoEn)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, data.nombre, data.descripcion ?? null, data.estadoActivo ? 1 : 0],
    );
    return { id };
  },

  async actualizar(id: string, data: ActualizarMetodoPagoInput): Promise<{ ok: true } | Fallo> {
    const actual = await this.buscarPorId(id);
    if (!actual) return { error: "Método no encontrado", status: 404 };

    if (data.nombre !== undefined && await this.nombreRepetido(data.nombre, id)) {
      return { error: "Ya existe un método con ese nombre.", status: 409 };
    }
    // No se puede apagar el último método activo
    if (data.estadoActivo === false && Number(actual.EstadoActivo) === 1 && await this.activos() <= 1) {
      return { error: ULTIMO_ACTIVO, status: 409 };
    }

    const campos: string[] = [];
    const valores: unknown[] = [];
    if (data.nombre !== undefined) {
      campos.push("Nombre = ?");
      valores.push(data.nombre);
    }
    if (data.descripcion !== undefined) {
      campos.push("Descripcion = ?");
      valores.push(data.descripcion);
    }
    if (data.estadoActivo !== undefined) {
      campos.push("EstadoActivo = ?");
      valores.push(data.estadoActivo ? 1 : 0);
    }
    if (!campos.length) return { ok: true };

    valores.push(id);
    await conexion.execute(
      `UPDATE metodospago SET ${campos.join(", ")} WHERE MetodoPagoId = ?`,
      valores,
    );
    return { ok: true };
  },

  // No se borra: se desactiva (los pagos ya hechos conservan su método)
  async eliminar(id: string): Promise<{ ok: true } | Fallo> {
    return await this.actualizar(id, { estadoActivo: false });
  },
};
