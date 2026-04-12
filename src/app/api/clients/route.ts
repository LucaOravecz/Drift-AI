import { NextResponse } from "next/server";
// import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    /* 
    TODO FOR DEVELOPER:
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get("organizationId")
    
    const clients = await prisma.client.findMany({
      where: { organizationId: orgId },
      include: { intelligence: true }
    });
    return NextResponse.json(clients);
    */

    return NextResponse.json({ message: "API Stub: Implement Prisma query here." }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    /*
    TODO FOR DEVELOPER:
    const newClient = await prisma.client.create({
      data: {
        organizationId: body.organizationId,
        name: body.name,
        type: body.type,
      }
    });

    // Fire off async hook to generate initial AI intelligence profile
    // await queueIntelligenceScan(newClient.id);

    return NextResponse.json(newClient);
    */

    return NextResponse.json({ message: "API Stub: Client Creation", received: body }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
