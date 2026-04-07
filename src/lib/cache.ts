// Cache global em memória para evitar QuotaExceededError
export const dataCache = {
  abastecimentos: null as any[] | null,
  veiculosAtivos: null as Set<string> | null,
  
  clear() {
    this.abastecimentos = null;
    this.veiculosAtivos = null;
  }
};
