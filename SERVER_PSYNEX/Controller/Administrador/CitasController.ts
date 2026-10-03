import type { RouterContext } from "../../Dependencies/dependencias.ts";
import { listarCitasQuerySchema } from "../../Validators/Administrador/CitasValidator.ts";
import { CitasModel } from "../../Model/Administrador/CitasModel.ts";

export const CitasController = {
  // GET /api/admin/citas
  async listar(ctx: RouterContext<string>) {
    const query = Object.fromEntries(ctx.request.url.searchParams.entries());
    const validacion = listarCitasQuerySchema.safeParse(query);

    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: validacion.error.issues.map((i) => i.message),
      };
      return;
    }

    try {
      const { citas, total } = await CitasModel.listar(validacion.data);
      const resumen = await CitasModel.resumen();

      ctx.response.body = {
        ok: true,
        resumen,
        total,
        pagina: validacion.data.pagina,
        porPagina: validacion.data.porPagina,
        citas,
      };
    } catch (error) {
      console.error("Error al listar citas:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Error al obtener las citas" };
    }
  },

  // GET /api/admin/citas/:id
  async detalle(ctx: RouterContext<string>) {
    const id = ctx.params.id;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Falta el id de la cita" };
      return;
    }

    try {
      const cita = await CitasModel.buscarPorId(id);
      if (!cita) {
        ctx.response.status = 404;
        ctx.response.body = { error: "Cita no encontrada" };
        return;
      }
      ctx.response.body = { ok: true, cita };
    } catch (error) {
      console.error("Error al obtener cita:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Error al obtener la cita" };
    }
  },
};