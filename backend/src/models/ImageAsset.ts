import mongoose, { Schema, Types } from "mongoose";

export type ImageAssetDoc = {
  productId: Types.ObjectId;
  creatorId: Types.ObjectId;

  source: {
    sourceUrl: string;
    sourcePageUrl?: string;
  };

  cloudinary: {
    publicId: string;
    secureUrl: string;
    folder: string;
  };

  meta: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    width: number;
    height: number;
  };

  orderIndex: number;

  createdAt: Date;
  updatedAt: Date;
};

const ImageAssetSchema = new Schema<ImageAssetDoc>(
  {
    productId: { type: Schema.Types.ObjectId, required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, required: true, index: true },

    source: {
      sourceUrl: { type: String, required: true },
      sourcePageUrl: { type: String },
    },

    cloudinary: {
      publicId: { type: String, required: true },
      secureUrl: { type: String, required: true },
      folder: { type: String, required: true },
    },

    meta: {
      filename: { type: String, required: true },
      contentType: { type: String, required: true },
      sizeBytes: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },

    orderIndex: { type: Number, required: true },
  },
  { timestamps: true }
);

export const ImageAsset = mongoose.model<ImageAssetDoc>(
  "ImageAsset",
  ImageAssetSchema
);
