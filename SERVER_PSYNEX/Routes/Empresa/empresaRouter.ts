import { Router } from "../Dependencies/dependencias.ts";
import {
    getPerfilEmpresa,
    getPerfilEmpresaPorId,
    getPerfilEmpresaPorUsuarioId,
    putPerfilEmpresa,
    postPerfilEmpresa,
    deletePerfilEmpresa,
} from "../Controller/perfilEmpresaController.ts";

const PerfilEmpresaRouter = new Router();

PerfilEmpresaRouter.get("/perfilempresa", getPerfilEmpresa);
PerfilEmpresaRouter.get("/perfilempresa/:id", getPerfilEmpresaPorId);
PerfilEmpresaRouter.get("/perfilempresa/usuario/:usuarioId", getPerfilEmpresaPorUsuarioId);
PerfilEmpresaRouter.put("/perfilempresa/:id", putPerfilEmpresa);
PerfilEmpresaRouter.post("/perfilempresa", postPerfilEmpresa);
PerfilEmpresaRouter.delete("/perfilempresa/:id", deletePerfilEmpresa);

export { PerfilEmpresaRouter };