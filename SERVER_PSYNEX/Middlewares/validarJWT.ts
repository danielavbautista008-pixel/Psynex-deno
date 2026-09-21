import { VerificarTokenAcceso } from "../Helpers/Jwt.TS";
import { Context,Next  } from "../Dependencies/dependencias.ts";
import { error } from "node:console";
import { ResponseTimeoutError } from "https://deno.land/x/mysql@v2.12.1/src/constant/errors.ts";


//Middleware para proteguer rutas de acceso 
export async function  authMiddleware(ctx:Context, next:Next){

    const authHearder = ctx.request.headers.get("Authorización");

    if (!authHearder){
        ctx.response.status = 400;
        ctx.response.body ={error:"No tiene Autorización"};
        return;
    }


    const token = authHearder.split (" ") [1];
    const usuario = await VerificarTokenAcceso (token);

    if (!usuario){
        ctx.response.status = 401;
        ctx.response.body = {error: "Token Inválido o expirado"};
        return
    }

    ctx.state.user = usuario;
    await next ();
}