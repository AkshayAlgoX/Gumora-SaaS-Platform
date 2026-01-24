import mongoose, { Types, Schema } from "mongoose";

export type ProductVisibility = "draft" | "published";


export type ProductDoc = {
  creatorId: Types.ObjectId;

  title: string;
  description: string;
  price: number;
  currency: "INR";

  visibility: ProductVisibility;
  slug: string;

  coverImageAssetId: Types.ObjectId | null;

  stats: {
    assetCount: number;
    soldCount: number;
  };

  createdAt: Date;
  updatedAt: Date;
};

const ProductSchema = new Schema<ProductDoc>({
  creatorId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  price: { type: Number, required: true },
  currency: { type: String, enum: ["INR"], default: "INR" },

  visibility: {
    type: String,
    enum: ["draft", "published"],
    default: "draft",
    index: true,
  },

  slug: { type: String, required: true, trim: true },
   coverImageAssetId: { type: Schema.Types.ObjectId, default: null },

stats: {
  assetCount: { type: Number, default: 0 },
  soldCount: { type: Number, default: 0 },
}
},{timestamps:true})

export const Product = mongoose.model<ProductDoc>("Product", ProductSchema);