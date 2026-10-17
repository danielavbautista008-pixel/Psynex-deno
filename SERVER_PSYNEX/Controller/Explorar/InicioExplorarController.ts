import type { Context } from "../../Dependencies/dependencias.ts";
import { PsicologosExplorarModel } from "../../Model/Explorar/PsicologosExplorarModel.ts";
import { OfertasExplorarModel } from "../../Model/Explorar/OfertasExplorarModel.ts";
import { CuestionariosExplorarModel } from "../../Model/Explorar/CuestionariosExplorarModel.ts";
import { responderError } from "../../Helpers/Peticion.ts";

// Tests que se muestran primero en la página Explorar (si existen y están activos)
const TESTS_DESTACADOS = ["PHQ-9", "GAD-7", "PSS-10"];

export const InicioExplorarController = {

  // GET /api/explorar/inicio  -> todo lo que necesita la página Explorar
  async inicio(ctx: Context) {
    try {
      const [cuestionarios, psicologos, ofertas] = await Promise.all([
        CuestionariosExplorarModel.listar(),
        PsicologosExplorarModel.listar({ modalidad: "todas" }),
        OfertasExplorarModel.listar(String(ctx.state.usuario?.id ?? ""), { modalidad: "todas" }, 3),
      ]);
      const destacados = TESTS_DESTACADOS
        .map((s) => cuestionarios.find((c) => c.sigla === s))
        .filter((c) => c !== undefined);
      const tests = [...destacados, ...cuestionarios.filter((c) => !destacados.includes(c))].slice(0, 3);

      ctx.response.body = { ok: true, tests, psicologos: psicologos.slice(0, 8), ofertas };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al cargar Explorar");
    }
  },
};
