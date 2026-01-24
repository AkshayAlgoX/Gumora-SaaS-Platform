import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export function uploadImageBufferToCloudinary(input: {
  buffer: Buffer;
  folder: string;
  fileNameNoExt: string;
}) {
  return new Promise<{ publicId: string; secureUrl: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: input.folder,
          public_id: input.fileNameNoExt,
          resource_type: "image",
        },
        (err, result) => {
          if (err || !result)
            return reject(err || new Error("cloudinary upload failed"));

          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
          });
        }
      );

      stream.end(input.buffer);
    }
  );
}
