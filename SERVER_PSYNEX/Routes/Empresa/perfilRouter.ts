import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  deletePerfilEmpresa,
  getPerfilEmpresa,
  getPerfilEmpresaPorId,
  getPerfilEmpresaPorUsuarioId,
  postPerfilEmpresa,
  putPerfilEmpresa,
} from "../../Controller/Empresa/perfilController.ts";

// Importación del middleware comentada
import { requireAuth } from "../../Middlewares/RequireAuth.ts";

const PerfilEmpresaRouter = new Router();

// Rutas públicas / de consulta
PerfilEmpresaRouter.get("/api/perfilempresa", getPerfilEmpresa);
PerfilEmpresaRouter.get("/api/perfilempresa/:PerfileId", getPerfilEmpresaPorId);
PerfilEmpresaRouter.get("/api/perfilempresa/usuario/:usuarioId", getPerfilEmpresaPorUsuarioId);

// Rutas desprotegidas temporalmente (authMiddleware comentado)
PerfilEmpresaRouter.post("/api/perfilempresa",  requireAuth,  postPerfilEmpresa);
PerfilEmpresaRouter.put("/api/perfilempresa/:id",requireAuth, putPerfilEmpresa);
PerfilEmpresaRouter.delete( "/api/perfilempresa/:id", requireAuth, deletePerfilEmpresa);

export { PerfilEmpresaRouter };