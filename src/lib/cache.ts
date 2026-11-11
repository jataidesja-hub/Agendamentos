// Cache global em memória para evitar QuotaExceededError
export const dataCache = {
  abastecimentos: null as any[] | null,
  veiculosAtivos: null as Set<string> | null,
  placaToProject: null as Map<string, string> | null,
  placaToGerente: null as Map<string, string> | null,
  placaToAdmin: null as Map<string, string> | null,
  placaToModel: null as Map<string, string> | null,
  
  clear() {
    this.abastecimentos = null;
    this.veiculosAtivos = null;
    this.placaToProject = null;
    this.placaToGerente = null;
    this.placaToAdmin = null;
    this.placaToModel = null;
  }
};

