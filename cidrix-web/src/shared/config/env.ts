export interface ClientEnvironment {
  apiUrl: string
}

export interface ClientEnvironmentSource {
  VITE_API_URL?: unknown
}

export function parseClientEnvironment(
  source: ClientEnvironmentSource,
): ClientEnvironment {
  const rawApiUrl = source.VITE_API_URL

  if (typeof rawApiUrl !== 'string' || rawApiUrl.trim() === '') {
    throw new Error('VITE_API_URL es obligatoria')
  }

  const value = rawApiUrl.trim()

  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    throw new Error('VITE_API_URL debe ser una URL válida')
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(value)
  } catch {
    throw new Error('VITE_API_URL debe ser una URL válida')
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('VITE_API_URL debe usar el protocolo http o https')
  }

  const apiUrl = parsedUrl.toString().replace(/\/+$/, '')

  return { apiUrl }
}

export function getClientEnvironment(): ClientEnvironment {
  return parseClientEnvironment({
    VITE_API_URL: import.meta.env.VITE_API_URL,
  })
}
