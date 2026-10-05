import { Router } from "../Dependencies/dependencias.ts";
import {
    getPorUsuario,
    getPorEmpresa,
    postularse,
    putPostulacion,
    deletePostulacion,
} from "../Controller/postulacionController.ts";

const PostulacionRouter = new Router();

PostulacionRouter.get("/postulaciones/usuario/:usuarioId", getPorUsuario);
PostulacionRouter.get("/postulaciones/empresa/:perfileId", getPorEmpresa);
PostulacionRouter.post("/postulaciones", postularse);
PostulacionRouter.put("/postulaciones/:id", putPostulacion);
PostulacionRouter.delete("/postulaciones/:id", deletePostulacion);

export { PostulacionRouter };