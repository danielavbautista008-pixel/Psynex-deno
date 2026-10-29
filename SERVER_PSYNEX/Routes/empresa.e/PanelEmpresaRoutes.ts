// =====================================================================
// PANEL DE EMPRESA (carpeta empresa.e) — rutas con sesión de Empresa
// =====================================================================
import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { PanelEmpresaController } from "../../Controller/empresa.e/PanelEmpresaController.ts";

const router = new Router({ prefix: "/api/empresa" });
const soloEmpresa = [requireAuth, requiereRol("Empresa")] as const;

router.get("/perfil", ...soloEmpresa, PanelEmpresaController.perfil);
router.put("/perfil", ...soloEmpresa, PanelEmpresaController.guardarPerfil);
router.get("/resumen", ...soloEmpresa, PanelEmpresaController.resumen);

router.get("/ofertas", ...soloEmpresa, PanelEmpresaController.ofertas);
router.post("/ofertas", ...soloEmpresa, PanelEmpresaController.crearOferta);
router.put("/ofertas/:id", ...soloEmpresa, PanelEmpresaController.editarOferta);
router.patch("/ofertas/:id/estado", ...soloEmpresa, PanelEmpresaController.estadoOferta);

router.patch("/postulaciones/:id/estado", ...soloEmpresa, PanelEmpresaController.estadoPostulacion);

router.get("/favoritos", ...soloEmpresa, PanelEmpresaController.favoritos);
router.post("/favoritos/:perfilId", ...soloEmpresa, PanelEmpresaController.agregarFavorito);
router.delete("/favoritos/:perfilId", ...soloEmpresa, PanelEmpresaController.quitarFavorito);

export default router;
