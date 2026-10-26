import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  deleteOferta,
  getContarOfertasEmpresa,
  getOfertaById,
  getOfertas,
  getOfertasByEmpresa,
  getOfertasPublicas,
  patchDesactivarOferta,
  postOferta,
  putOferta,
} from "../../Controller/Empresa/ofertaController.ts";

// Importación comentada mientras pruebas sin middleware
// import { authMiddleware } from "../Middlewares/validarJWT.ts";

const ofertaLaboralRouter = new Router();

// Rutas públicas / de consulta
ofertaLaboralRouter.get("/api/ofertas", getOfertas);
ofertaLaboralRouter.get("/api/ofertas/publicas", getOfertasPublicas);
ofertaLaboralRouter.get("/api/ofertas/:OfertaId", getOfertaById);
ofertaLaboralRouter.get("/api/ofertas/empresa/:PerfileId", getOfertasByEmpresa);
ofertaLaboralRouter.get("/api/ofertas/empresa/:PerfileId/contar", getContarOfertasEmpresa);

// Rutas de escritura y administración (AuthMiddleware comentado temporalmente)
ofertaLaboralRouter.post("/api/ofertas", /* authMiddleware, */ postOferta);
ofertaLaboralRouter.put("/api/ofertas/:OfertaId", /* authMiddleware, */ putOferta);
ofertaLaboralRouter.patch(
  "/api/ofertas/:OfertaId/desactivar",
  /* authMiddleware, */ patchDesactivarOferta
);
ofertaLaboralRouter.delete(
  "/api/ofertas/:OfertaId",
  /* authMiddleware, */ deleteOferta
);

export default ofertaLaboralRouter;