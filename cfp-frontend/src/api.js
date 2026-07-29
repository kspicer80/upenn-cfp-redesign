/**
 * api.js — Thin wrappers around fetch.
 * Uses the configured backend URL in production and falls back to the local
 * dev server during development.
 */

const DEFAULT_BASE = "https://upenn-cfp-redesign.onrender.com";
export const BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;u
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.detail || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const get   = (path)       => request(path);
export const post  = (path, body) => request(path, { method: "POST",   body });
export const patch = (path, body) => request(path, { method: "PATCH",  body });
export const del   = (path)       => request(path, { method: "DELETE" });
