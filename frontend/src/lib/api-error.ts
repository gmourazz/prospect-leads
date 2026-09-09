/** Mirrors the RFC 9457 problem+json the backend returns. */
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public detail: string,
    public requestId?: string,
    public meta?: Record<string, unknown>,
  ) {
    super(detail)
    this.name = 'ApiError'
  }

  /** Failing to send is never ambiguous: say plainly that nothing was duplicated. */
  get userMessage() {
    switch (this.code) {
      case 'already_contacted':
        return 'Este contato já recebeu mensagem. Use "Enviar novamente" se quiser recontatar.'
      case 'contact_suppressed':
        return 'Este número está na lista de não contatar.'
      case 'recontact_approval_required':
        return 'Recontato exige confirmação explícita.'
      case 'batch_in_progress':
        return 'Um envio já está em andamento. Aguarde alguns segundos.'
      case 'idempotency_key_reuse':
        return 'Requisição inconsistente. Recarregue a página e tente de novo.'
      case 'no_eligible_targets':
        return 'Nenhum contato disponível para este filtro.'
      case 'provider_unavailable':
        return 'Serviço de envio indisponível. Nenhuma mensagem duplicada foi enviada.'
      default:
        return this.detail || 'Algo deu errado.'
    }
  }
}
