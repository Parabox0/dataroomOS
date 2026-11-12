import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

// There is no landing page. Signed-in people go to their rooms, everyone else to sign in.
export default async function Home() {
  redirect((await currentUser()) ? "/rooms" : "/sign-in");
}
