export function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}


export async function ensureUniqueSlug(base:string,exists:(slug:string)=>Promise<boolean>){
    let slug=base;
    let n=2
    while(await exists(slug)){
        slug= `${base}-${n}`
        n++
    }
    return slug;
}