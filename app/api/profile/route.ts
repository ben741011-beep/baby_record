import { apiError } from "@/lib/api-response";
import { getBabyProfile, saveBabyProfileName } from "@/models/BabyProfile";

export async function GET() {
  try {
    return Response.json({ profile: await getBabyProfile() });
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown };
    return Response.json({ profile: await saveBabyProfileName(body.name) });
  } catch (error) {
    return apiError(error);
  }
}
