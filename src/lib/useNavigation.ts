"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "cymi_nav_order";

export interface NavItem {
  id: string;
  name: string;
  href: string;
  iconName: string;
}

// Lista padrão de navegação (ordem original)
const DEFAULT_NAV: NavItem[] = [
  { id: "agenda", name: "Agendamentos", href: "/dashboard", iconName: "CalendarIcon" },
  { id: "tarefas", name: "Notas Pessoais", href: "/dashboard/lista", iconName: "QueueListIcon" },
  { id: "alertas", name: "Alertas", href: "/dashboard/alertas", iconName: "BellAlertIcon" },
  { id: "relatorios", name: "Relatórios", href: "/dashboard/relatorios", iconName: "ChartBarIcon" },
  { id: "sustentabilidade", name: "Sustentabilidade", href: "/dashboard/sustentabilidade", iconName: "GlobeAmericasIcon" },
  { id: "configuracoes", name: "Configurações", href: "/dashboard/configuracoes", iconName: "Cog6ToothIcon" },
  { id: "chaves", name: "Controle de Chaves", href: "/dashboard/chaves", iconName: "KeyIcon" },
  { id: "perfis", name: "Perfis", href: "/dashboard/usuarios", iconName: "UserGroupIcon" },
  { id: "veiculos", name: "Frotas", href: "/dashboard/veiculos", iconName: "TruckIcon" },
  { id: "projetos", name: "Projetos", href: "/dashboard/fazendas", iconName: "MapIcon" },
  { id: "abastecimentos", name: "Abastecimentos", href: "/dashboard/abastecimentos", iconName: "ChartBarIcon2" },
  { id: "manutencao", name: "Manutenção", href: "/dashboard/manutencao", iconName: "TruckIcon2" },
  { id: "compras", name: "Gestão de Compras", href: "/dashboard/compras", iconName: "ShoppingCartIcon" },
  { id: "materiais", name: "Controle de Materiais", href: "/dashboard/materiais", iconName: "ArchiveBoxIcon" },
  { id: "checklist", name: "Checklist Veículos", href: "/dashboard/checklist", iconName: "ClipboardDocumentCheckIcon" },
  { id: "km", name: "Relatório de KM", href: "/dashboard/km", iconName: "MapPinIcon" },
  { id: "cot", name: "PORTAL – COT", href: "/dashboard/cot", iconName: "TableCellsIcon" },
  { id: "multas", name: "Multas", href: "/dashboard/multas", iconName: "ClipboardDocumentCheckIcon" },
  { id: "telecom", name: "Controle Telecom", href: "/dashboard/telecom", iconName: "PhoneIcon" },
  { id: "informacoes", name: "Informações", href: "/dashboard/informacoes", iconName: "InformationCircleIcon" },
  { id: "solicitacoes", name: "Solicitações de Manut.", href: "/dashboard/solicitacoes", iconName: "WrenchScrewdriverIcon" },
];

// Nomes curtos para mobile
export const MOBILE_NAMES: Record<string, string> = {
  agenda: "Agenda",
  tarefas: "Notas",
  alertas: "Alertas",
  relatorios: "Painel",
  sustentabilidade: "Sustent.",
  configuracoes: "Config.",
  chaves: "Chaves",
  perfis: "Perfis",
  veiculos: "Frotas",
  projetos: "Projetos",
  abastecimentos: "Abastec.",
  manutencao: "Manut.",
  compras: "Compras",
  materiais: "Materiais",
  checklist: "Checklist",
  km: "KM",
  cot: "COT",
  multas: "Multas",
  telecom: "Telecom",
  informacoes: "Info",
  solicitacoes: "Solicit.",
};

function getSavedOrder(): string[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function saveOrder(order: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {}
}

export function useNavigation() {
  const [permissões, setPermissões] = useState<string[]>([]);
  const [navOrder, setNavOrder] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Carrega permissões e ordem salva
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const email = session.user.email || "";

        supabase
          .from("perfis_acesso")
          .select("telas_acesso")
          .eq("email", email)
          .single()
          .then(({ data }) => {
            if (data?.telas_acesso) {
              setPermissões(data.telas_acesso);
            } else if (email === "logistica@cymi.com.br") {
              setPermissões([
                "agenda", "alertas", "relatorios", "configuracoes",
                "chaves", "perfis", "veiculos", "projetos",
                "abastecimentos", "sustentabilidade", "manutencao", "compras", "materiais", "checklist", "km",
              ]);
            }
          });
      }
    });

    // Carrega ordem salva
    const saved = getSavedOrder();
    if (saved) {
      setNavOrder(saved);
    } else {
      setNavOrder(DEFAULT_NAV.map((n) => n.id));
    }
    setLoaded(true);
  }, []);

  // Navegação filtrada e ordenada
  const navigation = (() => {
    const filtered = DEFAULT_NAV.filter((item) => permissões.includes(item.id));

    // Ordenar com base na ordem salva
    if (navOrder.length > 0) {
      filtered.sort((a, b) => {
        const idxA = navOrder.indexOf(a.id);
        const idxB = navOrder.indexOf(b.id);
        // Items não encontrados na ordem vão para o final
        const posA = idxA === -1 ? 999 : idxA;
        const posB = idxB === -1 ? 999 : idxB;
        return posA - posB;
      });
    }

    return filtered;
  })();

  // Reordenar: mover item de fromIndex para toIndex
  const reorder = useCallback(
    (fromId: string, toId: string) => {
      const currentIds = navigation.map((n) => n.id);
      const fromIndex = currentIds.indexOf(fromId);
      const toIndex = currentIds.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

      const newOrder = [...currentIds];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);

      setNavOrder(newOrder);
      saveOrder(newOrder);
    },
    [navigation]
  );

  return { navigation, reorder, loaded };
}
