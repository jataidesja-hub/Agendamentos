"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, BellAlertIcon, QueueListIcon, ChartBarIcon, KeyIcon, UserGroupIcon, TruckIcon, MapIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MobileNav() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [permissões, setPermissões] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const email = session.user.email || "";
        setUserEmail(email);
        
        // Busca permissões na tabela perfis_acesso
        supabase
          .from('perfis_acesso')
          .select('telas_acesso')
          .eq('email', email)
          .single()
          .then(({ data }) => {
            if (data?.telas_acesso) {
              setPermissões(data.telas_acesso);
            } else if (email === "logistica@cymi.com.br") {
              setPermissões(['agenda', 'alertas', 'relatorios', 'configuracoes', 'chaves', 'perfis', 'veiculos', 'projetos', 'abastecimentos']);
            }
          });
      }
    });
  }, []);

  const allNavigation = [
    { id: 'agenda', name: "Agenda", href: "/dashboard", icon: CalendarIcon },
    { id: 'tarefas', name: "Tarefas", href: "/dashboard/lista", icon: QueueListIcon },
    { id: 'alertas', name: "Alertas", href: "/dashboard/alertas", icon: BellAlertIcon },
    { id: 'relatorios', name: "Painel", href: "/dashboard/relatorios", icon: ChartBarIcon },
    { id: 'chaves', name: "Chaves", href: "/dashboard/chaves", icon: KeyIcon },
    { id: 'perfis', name: "Perfis", href: "/dashboard/usuarios", icon: UserGroupIcon },
    { id: 'veiculos', name: "Veículos", href: "/dashboard/veiculos", icon: TruckIcon },
    { id: 'projetos', name: "Projetos", href: "/dashboard/fazendas", icon: MapIcon },
    { id: 'abastecimentos', name: "Abastecimentos", href: "/dashboard/abastecimentos", icon: ChartBarIcon },
  ];

  const navigation = allNavigation.filter(item => permissões.includes(item.id));

  return (
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/40 dark:border-gray-800/50 shadow-2xl rounded-[2rem] px-4 py-3">
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-2xl transition-all duration-300 shrink-0 ${
                  isActive
                    ? "text-[#0b7336] dark:text-green-400 bg-green-50/50 dark:bg-green-500/10 scale-105 shadow-sm"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                }`}
              >
                <item.icon className={`h-6 w-6 ${isActive ? "stroke-2 mb-1" : "stroke-1"}`} aria-hidden="true" />
                <span className={`text-[9px] font-black uppercase tracking-tighter transition-all duration-300 ${isActive ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden"}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
