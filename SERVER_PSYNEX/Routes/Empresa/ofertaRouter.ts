import { Router } from "../Dependencies/dependencias.ts";
import {
    getOfertas,
    getOfertasPorEmpresa,
    contarOfertasActivasPorEmpresa,
    getPublicos,
    postOferta,
    putOferta,
    deleteOferta,
} from "../Controller/ofertaLaboralController.ts";

const OfertaLaboralRouter = new Router();

OfertaLaboralRouter.get("/ofertaslaborales", getOfertas);
OfertaLaboralRouter.get("/ofertaslaborales/publicos", getPublicos);
OfertaLaboralRouter.get("/ofertaslaborales/empresa/:perfileId", getOfertasPorEmpresa);
OfertaLaboralRouter.get("/ofertaslaborales/empresa/:perfileId/contar", contarOfertasActivasPorEmpresa);
OfertaLaboralRouter.post("/ofertaslaborales", postOferta);
OfertaLaboralRouter.put("/ofertaslaborales/:id", putOferta);
OfertaLaboralRouter.delete("/ofertaslaborales/:id", deleteOferta);

export { OfertaLaboralRouter };