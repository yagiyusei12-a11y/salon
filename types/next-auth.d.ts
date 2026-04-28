import { UserRole } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      isActive: boolean;
      tenantId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    isActive: boolean;
    tenantId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    isActive: boolean;
    tenantId: string;
  }
}
