import { isDemo } from "@/lib/env";
import { getUser } from "@/lib/viewer";

export async function GET() {
  return Response.json({ user: await getUser(), demo: isDemo });
}
