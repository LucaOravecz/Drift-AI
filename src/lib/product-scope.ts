import "server-only";

import { notFound, redirect } from "next/navigation";

export function enforceCoreProductRoute() {
  notFound();
}

export function redirectAppHome() {
  redirect("/meetings");
}
