/**
 * Shared multipart upload/download helpers.
 *
 * Rules:
 * - NEVER manually set Content-Type — let axios+browser set the multipart boundary.
 * - NEVER JSON-stringify a FormData payload.
 * - Uses the shared `http` axios instance (JWT interceptor attaches Authorization header).
 *
 * Why no headers config?
 * Axios detects FormData instances automatically and sets the correct
 * `Content-Type: multipart/form-data; boundary=<generated>` header on its own.
 * Explicitly passing `headers: { 'Content-Type': undefined }` keeps the key
 * present in the headers object (with JS value `undefined`), which is fragile:
 * any interceptor that uses `Object.assign` or serialises headers could turn
 * the `undefined` into the string "undefined". Omitting the headers field
 * entirely is the safest approach.
 */
import { http } from './http'

/**
 * Upload a file as multipart/form-data.
 *
 * @param url    - API endpoint path (e.g. '/admin/employees/:id/documents')
 * @param formData - The FormData object to upload; axios sets Content-Type + boundary automatically
 * @returns The parsed response data
 */
export async function uploadMultipart<T = unknown>(url: string, formData: FormData): Promise<T> {
  // No headers config — axios auto-detects FormData and generates the correct
  // multipart boundary. Passing any headers object here risks header pollution.
  const response = await http.post<T>(url, formData)
  return response.data
}

/**
 * Download a file by its URL or file ID endpoint.
 *
 * @param url - API endpoint path (e.g. '/files/:fileId')
 * @returns A Blob containing the file data
 */
export async function downloadFile(url: string): Promise<Blob> {
  const response = await http.get<Blob>(url, {
    responseType: 'blob',
  })
  return response.data
}
