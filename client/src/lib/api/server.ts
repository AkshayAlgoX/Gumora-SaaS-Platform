import "server-only";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export async function apiServerGet<T>(path: string): Promise<T> {
  const cookieStore = await cookies();

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: { cookie: cookieStore.toString() },
      credentials: "include",
      cache: "no-store",
    });
    
    // Handle 401 (unauthorized) and 403 (forbidden) gracefully
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: res.status === 401 ? 'Unauthorized' : 'Forbidden' } as T;
    }
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const text = await res.text();
    if (!text) {
      throw new Error('Empty response');
    }
    
    return JSON.parse(text);
  } catch (error) {
    console.error(`API Error for ${path}:`, error);
    return { ok: false, error: 'Server connection failed' } as T;
  }
}

export async function apiServerPost<T>(path: string,body:unknown): Promise<T> {
  const cookieStore = await cookies();

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { 
          "content-type" : "application/json",
          cookie: cookieStore.toString()
      },
      body: JSON.stringify(body),
      credentials: "include",
      cache: "no-store",
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const text = await res.text();
    if (!text) {
      throw new Error('Empty response');
    }
    
    return JSON.parse(text);
  } catch (error) {
    console.error(`API Error for ${path}:`, error);
    return { ok: false, error: 'Server connection failed' } as T;
  }
}