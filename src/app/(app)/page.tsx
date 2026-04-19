import { redirectAppHome } from "@/lib/product-scope";

export const revalidate = 0;

export default async function Page() {
  redirectAppHome();
}
