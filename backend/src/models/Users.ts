import mongoose, { Schema } from "mongoose";

export type UserDoc = {
    name : string;
    email : string;
    passwordHash : string;
    isCreator: boolean;
    createdAt : Date;
    updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
    {
        name : {type : String, required: true, trim: true},
        email : {type : String, required: true, trim: true, lowercase : true, unique: true},
        passwordHash : {type : String, required : true},
        isCreator : {type : Boolean, default : false}
    },
    {
        timestamps:true,
    }
)

export const User = mongoose.model<UserDoc>("User", UserSchema);