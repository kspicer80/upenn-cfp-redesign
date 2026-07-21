/**
 * api.js — Thin wrappers around fetch.
 * Relative URLs so the same code works via Vite's dev proxy locally and
 * via same-origin requests once deployed (frontend and backend both
 * behind the same domain, or CORS-enabled cross-origin in production).
 */

const BASE = "";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
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
