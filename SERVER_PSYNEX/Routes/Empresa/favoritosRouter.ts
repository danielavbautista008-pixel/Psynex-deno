import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  deleteFavorito,
  getFavoritos,
  getFavoritosPorPerfilId,
  patchEstadoFavorito,
  postFavorito,
} from "../../Controller/Empresa/FavoritoController.ts";

// Importación comentada mientras pruebas sin middleware de autenticación
// import { authMiddleware } from "../Middlewares/validarJWT.ts";

const favoritosRouter = new Router();

// Rutas públicas / de consulta
favoritosRouter.get("/api/favoritos", getFavoritos);
favoritosRouter.get("/api/favoritos/perfil/:perfileId", getFavoritosPorPerfilId);

// Rutas de administración (AuthMiddleware comentado temporalmente)
favoritosRouter.post("/api/favoritos", /* authMiddleware, */ postFavorito);
favoritosRouter.patch("/api/favoritos/:id/estado", /* authMiddleware, */ patchEstadoFavorito);
favoritosRouter.delete("/api/favoritos/:id", /* authMiddleware, */ deleteFavorito);

export default favoritosRouter;