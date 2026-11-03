/** Cliente HTTP do navegador para a API interna. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  get hint(): string | null {
    const details = this.details as { hint?: string } | undefined;
    return details?.hint ?? null;
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error ?? {};
    throw new ApiError(
      response.status,
      error.message ?? (response.status >= 500 ? "Erro no servidor." : "Não foi possível concluir a ação."),
      error.code ?? "erro",
      error.details,
    );
  }
  return body as T;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor.", "rede");
  }
  return parse<T>(response);
}

/**
 * Envia um arquivo com progresso (XMLHttpRequest, pois fetch não informa o
 * progresso de upload). O corpo é o arquivo bruto; metadados vão na URL.
 */
export function uploadFile<T>(
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const response = new Response(xhr.responseText || null, { status: xhr.status });
      parse<T>(response).then(resolve, reject);
    };
    xhr.onerror = () => reject(new ApiError(0, "A conexão caiu durante o envio.", "rede"));
    xhr.onabort = () => reject(new ApiError(0, "Envio cancelado.", "cancelado"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.hint ? `${error.message} ${error.hint}` : error.message;
  return error instanceof Error ? error.message : "Erro inesperado.";
}
