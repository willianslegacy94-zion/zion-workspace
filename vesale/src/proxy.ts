export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/", "/pdv/:path*", "/notas-fiscais/:path*"],
};
