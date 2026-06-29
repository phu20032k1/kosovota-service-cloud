import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const activations = await prisma.activation.findMany({
    include: {
      machine: {
        include: {
          customer: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    success: true,
    data: activations,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const activation = await prisma.activation.create({
    data: {
      machineId: body.machineId,
      step: body.step,
      installerName: body.installerName,
      installerPhone: body.installerPhone,
      dealerCode: body.dealerCode,
      ownerName: body.ownerName,
      ownerPhone: body.ownerPhone,
      note: body.note,
      bankAccount: body.bankAccount,
      bankOwner: body.bankOwner,
      bankName: body.bankName,
    },
  });

  return NextResponse.json({
    success: true,
    data: activation,
  });
}