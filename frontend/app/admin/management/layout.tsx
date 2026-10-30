"use client";

import type { ReactNode } from "react";
import ManagementShell from "../../../components/management/ManagementShell";

export default function ManagementLayout({ children }: { children: ReactNode }) {
  return <ManagementShell>{children}</ManagementShell>;
}
