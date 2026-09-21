import {create, verify,getNumericDate} from "../Dependencies/dependencias.ts";
import {generateKey} from "./CriptoKey.ts";

const key = Deno.env.get ("MY_SECRET_KEY") || "default_key";
const server = Deno.env.get ("SERVER");

export const CrearToken = async(userId:string ) => {

    const payload = {
        iss : server,
        sub : userId,
        jti: crypto.randomUUID(),
        exp: getNumericDate(60 * 60),

    }
    const secretKey = await generateKey (key);

    return await create ({alg: "HS256",typ: "JWT" },payload, secretKey );

}

export const VerificarTokenAcceso = async (token: string)=>{
    const secretKey = await generateKey (key);
    try {
        return await verify (token,secretKey);
    } catch (error) {
        console.error ("token invalido:",error );
       return null; 
    }


}

