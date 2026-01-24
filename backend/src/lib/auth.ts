import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'

export type JwtPayload={userId:string}
export async function hashPassword(pass: string){
    return bcrypt.hash(pass, 10);
}

export async function verifyPassword(pass: string, hashPass: string){
    return bcrypt.compare(pass, hashPass);
}

export function signJwt(payload:jwt.JwtPayload){
    return jwt.sign(payload, process.env.JWT_SECRET!,{
        expiresIn:process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
    })
}

export function verifyJwt(token: string): JwtPayload{
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
}