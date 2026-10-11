/**
 * Blindagem do fetch do Supabase (browser): garante que TODA requisição ao
 * projeto carregue os headers apikey/Authorization, mesmo que algum caminho
 * do código ou do navegador os perca. Sem dependências (testável em Node).
 */

export function createKeyedFetch(fetchImpl, supabaseUrl, anonKey) {
  const base = String(supabaseUrl || '').replace(/\/$/, '');
  const getHeader = (headers, name) => {
    if (!headers) return null;
    if (typeof Headers !== 'undefined' && headers instanceof Headers) return headers.get(name);
    return headers[name] ?? headers[name.toLowerCase()] ?? null;
  };
  return (url, options = {}) => {
    const target = String((url && url.url) || url || '');
    if (base && target.startsWith(base) && !getHeader(options.headers, 'apikey')) {
      let headers = options.headers;
      if (typeof Headers !== 'undefined' && headers instanceof Headers) {
        headers = new Headers(headers);
        headers.set('apikey', anonKey);
        if (!headers.get('authorization')) headers.set('Authorization', 'Bearer ' + anonKey);
      } else {
        headers = { ...(headers || {}), apikey: anonKey };
        if (!headers.Authorization && !headers.authorization) headers.Authorization = 'Bearer ' + anonKey;
      }
      options = { ...options, headers };
    }
    return fetchImpl(url, options);
  };
}

/**
 * Traduz erros técnicos do Supabase em orientação acionável no painel.
 */
export function explainSupabaseError(message) {
  const m = String(message || '');
  if (/no api key/i.test(m)) {
    return '🔌 O navegador enviou a gravação sem a chave de acesso (a leitura funciona). Desative AdBlock/Brave Shields ou qualquer modo restrito para esta página e recarregue. Se persistir, confira se o projeto Supabase está ativo (não pausado).';
  }
  if (/loja n.o autorizada/i.test(m)) {
    return '🔒 Sessão sem permissão nesta loja. Saia e entre novamente no painel.';
  }
  return m;
}
