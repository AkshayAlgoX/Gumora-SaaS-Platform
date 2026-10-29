import {Response, Request, NextFunction} from 'express'
import { verifyJwt } from '../lib/auth';
import { User } from '../models/Users';

export type AuthedRequest = Request & {
    user?: {id: string; name: string; email : string; isCreator: Boolean}
}

export async function requireAuth(req:AuthedRequest, res: Response, next: NextFunction){

    try{
        const token = req.cookies?.[process.env.COOKIE_NAME!]
        if(!token){
            return res.status(401).json({
                ok: false,
                error: "Unauth user! Please log in."
            })
        }

        const payload=verifyJwt(token)
        const user = await User.findById(payload.userId).lean();

if(!user){
    return res.status(401).json({
        ok: false,
        error : 'Invalid session'
    })
}
req.user = {
    id : String(user._id),
    name : user.name,
    email : user.email,
    isCreator : user.isCreator
}
 
      next();

    }catch(err){
         console.log(err);
         res.status(401).json({
         ok: false,
        error: "Invalid session",
        });

    }
}
