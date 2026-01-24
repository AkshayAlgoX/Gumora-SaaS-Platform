export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
  <div className="flex-1">
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      {children}
    </div>
  </div>
  <div className="relative hidden w-[40vw] border-l border-zinc-200 lg:block">
    <img
      src={
        "https://assets.gumroad.com/packs/static/822e112a3b444c69f7ef.png"
      }
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
    />
  </div>
</div>

  );
}
