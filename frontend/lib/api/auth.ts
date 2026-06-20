import type { User } from "../types";
import { apiFetch } from "./client";

export async function login(firstName: string, pin: number) {
  return apiFetch<{
    access_token: string;
    user: User;
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ first_name: firstName, pin }),
  });
}

export async function fetchMe() {
  return apiFetch<User>("/api/me");
}
