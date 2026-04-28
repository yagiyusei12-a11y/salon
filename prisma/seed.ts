import "dotenv/config";
import { hash } from "bcrypt";

import { prisma } from "@/lib/prisma";

async function main() {
  const ownerEmail = "owner@example.com";
  const ownerPassword = "password123";

  const tenant = await prisma.tenant.upsert({
    where: { id: "seed-tenant" },
    update: {},
    create: {
      id: "seed-tenant",
      name: "Demo Salon",
    },
  });

  const passwordHash = await hash(ownerPassword, 10);

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      name: "Demo Owner",
      role: "OWNER",
      tenantId: tenant.id,
      passwordHash,
    },
    create: {
      email: ownerEmail,
      name: "Demo Owner",
      role: "OWNER",
      tenantId: tenant.id,
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {
      name: "Demo Staff",
      role: "STAFF",
      isActive: true,
      tenantId: tenant.id,
      passwordHash: await hash("password123", 10),
    },
    create: {
      email: "staff@example.com",
      name: "Demo Staff",
      role: "STAFF",
      isActive: true,
      tenantId: tenant.id,
      passwordHash: await hash("password123", 10),
    },
  });

  const basicCut = await prisma.serviceMenu.upsert({
    where: { id: "seed-menu-basic-cut" },
    update: {
      name: "カット",
      durationMinutes: 60,
      price: 5000,
      tenantId: tenant.id,
    },
    create: {
      id: "seed-menu-basic-cut",
      name: "カット",
      durationMinutes: 60,
      price: 5000,
      tenantId: tenant.id,
    },
  });

  const color = await prisma.serviceMenu.upsert({
    where: { id: "seed-menu-color" },
    update: {
      name: "カラー",
      durationMinutes: 90,
      price: 8000,
      tenantId: tenant.id,
    },
    create: {
      id: "seed-menu-color",
      name: "カラー",
      durationMinutes: 90,
      price: 8000,
      tenantId: tenant.id,
    },
  });

  await prisma.customer.upsert({
    where: { id: "seed-customer-yamada" },
    update: {
      lastName: "山田",
      firstName: "花子",
      phone: "090-0000-1111",
      email: "hanako.yamada@example.com",
      tenantId: tenant.id,
    },
    create: {
      id: "seed-customer-yamada",
      lastName: "山田",
      firstName: "花子",
      phone: "090-0000-1111",
      email: "hanako.yamada@example.com",
      tenantId: tenant.id,
    },
  });

  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });
  const customer = await prisma.customer.findUnique({
    where: { id: "seed-customer-yamada" },
    select: { id: true },
  });

  if (owner && customer) {
    await prisma.payment.upsert({
      where: { id: "seed-payment-1" },
      update: {
        tenantId: tenant.id,
        amount: 5000,
        method: "CASH",
        staffId: owner.id,
        customerId: customer.id,
        paidAt: new Date(),
        note: "初回来店",
      },
      create: {
        id: "seed-payment-1",
        tenantId: tenant.id,
        amount: 5000,
        method: "CASH",
        staffId: owner.id,
        customerId: customer.id,
        paidAt: new Date(),
        note: "初回来店",
      },
    });
  }

  console.log(`Seed menus: ${basicCut.name}, ${color.name}`);

  console.log("Seed complete");
  console.log(`Login email: ${ownerEmail}`);
  console.log(`Login password: ${ownerPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
