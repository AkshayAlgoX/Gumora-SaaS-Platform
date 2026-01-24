import {Router} from 'express'
import { requireAuth } from '../middleware/requireAuth';
import { AuthedRequest } from '../middleware/requireAuth';
import { Product } from '../models/Product';
import { User } from '../models/Users';
import { ImageAsset } from '../models/ImageAsset';
import mongoose from 'mongoose';

const toSlug = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const ensureUniqueSlug = async (
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> => {
  let slug = baseSlug;
  let counter = 1;
  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
};






export const createProductRouter = Router();

createProductRouter.use(requireAuth);

async function loadOwnProduct(req: AuthedRequest) {
  const productId = req.params.productId;

  if (!mongoose.isValidObjectId(productId)) {
    return {
      product: null,
      error: 'Invalid product ID',
    };
  }

  const product = await Product.findById(productId);
  if (!product) {
    return {
      product: null,
      error: 'Product not found',
    };
  }
  if (String(product?.creatorId) !== req.user!.id) {
    return {
      product: null,
      error: 'You are not owner',
    };
  }

  return {
    product,error :null
  }
}



createProductRouter.post("/", async (req: AuthedRequest, res) => {
  try {
        const {title,price}=req.body ?? {}

        if(!title || typeof price!=='number'){
            return res.status(400).json({
                ok:false,
                error:"title and price is required"
            })
        }

        
        
        const baseSlug =toSlug(String(title));

        const slug= await ensureUniqueSlug(baseSlug,async(s)=>{
            const count =await Product.countDocuments({slug:s})
            return count>0
        })
        const creatorId =new mongoose.Types.ObjectId(req.user!.id);
        const product = await Product.create({
            creatorId,
            title:String(title),
            description:"",
            price:Number(price),
            currency:'INR',
            visibility:'draft',
            slug,
            coverImageAssetId:null,
            stats:{
                assetCount:0,
                soldCount:0
            }
        })
 
         await User.updateOne(
            {
                _id: creatorId,isCreator:false
            },
            {
                $set:{isCreator:true}
            }
         )

         return res.json({ok:true, product})


  } catch (e) {
    console.log(e);

    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

createProductRouter.get("/", async (req: AuthedRequest, res) => {
  try {
    const products = await Product.find({ creatorId: req.user!.id }).sort({createdAt : -1}).lean();


    return res.json({ ok: true, products });
  } catch (e) {
    console.log(e);

    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

createProductRouter.get("/:productId", async (req: AuthedRequest, res) => {
  try {
    const {product} = await loadOwnProduct(req);


if (!product) {
  return res.status(400).json({
    ok: false,
    error: "Product id is invalid or you dont have permission",
  });
}

return res.json({ ok: true, product });

  } catch (e) {
    console.log(e);

    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

createProductRouter.patch("/:productId", async (req: AuthedRequest, res) => {
  try {
       const {product,error} = await loadOwnProduct(req);
       
       if (!product) {
  return res.status(400).json({
    ok: false,
    error: "Product id is invalid or you dont have permission",
  });
}

  const { title, description, price } = req.body ?? {}

if (typeof title === 'string' && title.trim()) {
  product.title = title.trim()

  const baseSlug = toSlug(product.title)
  const slug = await ensureUniqueSlug(baseSlug, async (s) => {
    const existing = await Product.findOne({ slug: s }).lean();

    if (!existing) return false;
    return String(existing._id) !== String(product._id)
  })

  product.slug =slug;

  if (typeof description === 'string' && description.trim()){
    product.description=description.trim()
  }
  if(typeof price==='number'){
    product.price=price
  }

  await product.save()

return res.json({ ok: true, product })

}

 
  } catch (e) {
    console.log(e);

    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});



createProductRouter.patch("/:productId/cover", async (req: AuthedRequest, res) => {
  try {
    const {product} = await loadOwnProduct(req);
    if (!product) {
  return res.status(400).json({
    ok: false,
    error: "Product id is invalid or you dont have permission",
  });
}

const imageAssetId=String(req.body?.imageAssetId || "");

if (!mongoose.isValidObjectId(imageAssetId)) {
  return res.status(400).json({
    ok: false,
    error: "imageAssetId needed!!!",
  });
}

const asset = await ImageAsset.findById(imageAssetId).lean();

if (!asset) {
  return res.status(400).json({
    ok: false,
    error: "Asset not found! Please check your id",
  });
}

if (
  String(asset.productId) !== String(product._id) ||
  String(asset.creatorId) !== req.user!.id
) {
  return res.status(403).json({
    ok: false,
    error: "Forbidden. You are not owner of this asset",
  });
}


product.coverImageAssetId = new mongoose.Types.ObjectId(imageAssetId);
await product.save();

return res.json({ ok: true, product });





  } catch (e) {
    console.log(e);

    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

createProductRouter.patch("/:productId/publish", async (req: AuthedRequest, res) => {
  try {
    const {product} = await loadOwnProduct(req);
    if (!product) {
  return res.status(400).json({
    ok: false,
    error: "Product id is invalid or you dont have permission",
  });
}

  const assetCount = await ImageAsset.countDocuments({
  productId: product._id
});

if (assetCount === 0) {
  return res.status(400).json({
    ok: false,
    error: "You need atleast 1 image to upload",
  });
}
    product.visibility = "published";
product.stats.assetCount = assetCount;
await product.save();
return res.json({ ok: true, product });


  } catch (e) {
    console.log(e);

    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

