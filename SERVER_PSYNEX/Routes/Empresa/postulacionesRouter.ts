import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  deletePostulacion,
  getPostulacionById,
  getPostulacionesPorEmpresa,
  getPostulacionesPorUsuario,
  postPostulacion,
  putPostulacion,
} from "../../Controller/Empresa/postulacionesController.ts";

// Importación comentada mientras pruebas sin middleware
// import { authMiddleware } from "../Middlewares/validarJWT.ts";

const postulacionRouter = new Router();

// Rutas de consulta
postulacionRouter.get("/api/postulaciones/:id", getPostulacionById);
postulacionRouter.get(
  "/api/postulaciones/usuario/:usuarioId",
  getPostulacionesPorUsuario
);
postulacionRouter.get(
  "/api/postulaciones/empresa/:perfileId",
  getPostulacionesPorEmpresa
);

// Rutas de escritura (authMiddleware comentado temporalmente)
postulacionRouter.post("/api/postulaciones", /* authMiddleware, */ postPostulacion);
postulacionRouter.put("/api/postulaciones/:id", /* authMiddleware, */ putPostulacion);
postulacionRouter.delete(
  "/api/postulaciones/:id",
  /* authMiddleware, */ deletePostulacion
);

export default postulacionRouter;