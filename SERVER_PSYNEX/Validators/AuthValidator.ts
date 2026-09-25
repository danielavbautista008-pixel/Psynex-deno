//los esquemas de validación de Zod

import {z} from "../Dependencies/dependencias.ts";

export const registroSchema = z.object({      //registroSchema:Valida que el objeto de datos recibido contenga todas las propiedades requeridas y cumpla las reglas de validación definidas para cada propiedad, como el formato del correo electrónico, la longitud mínima de la contraseña y el formato de la fecha de nacimiento.
    nombreCompleto: z.string().trim().min(3,"El nombre es muy corto"),//Debe ser un texto (string). El método .trim() elimina los espacios en blanco sobrantes al inicio y al final. Exige mínimo 3 caracteres; de lo contrario, devuelve el mensaje "El nombre es muy corto
    fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"Fechainválida(AAAA-MM-DD)"), //Debe ser un texto que cumpla obligatoriamente con la expresión regular AAAA-MM-DD . Si no cumple la estructura, lanza el mensaje "Fecha inválida(AAAA-MM-DD)".
    rol: z.enum(["Paciente","Empresa"]), //rol: Solo permite un valor exacto dentro de la lista (un enum). El valor debe ser "paciente" o "Empresa". Si envían otra cosa (como "admin"), lo rechaza.
    email: z.string().trim().toLowerCase().email("Email inválido"), //Elimina espacios (.trim()), convierte todo el texto a minúsculas para estandarizarlo (.toLowerCase()) y verifica que la cadena tenga formato de correo válido.
    password: z.string().min(8, "La contraseña debe tener mínimo 8 caracteres"),//Debe ser un texto con una longitud mínima de 8 caracteres.
 });

 export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Email inválido"),//Elimina espacios (.trim()), convierte todo el texto a minúsculas para estandarizarlo (.toLowerCase()) y verifica que la cadena tenga formato de correo válido.
    password: z.string().min(1, "La contraseña es Obligatoria"),  //Debe ser un texto con una longitud mínima de 1 carácter. Si no se proporciona, devuelve el mensaje "La contraseña es Obligatoria".
 });

