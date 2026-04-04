"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, BellAlertIcon, QueueListIcon, ChartBarIcon, ArrowRightOnRectangleIcon, Cog6ToothIcon, KeyIcon, UserGroupIcon, TruckIcon, MapIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserEmail(session.user.email || null);
    });
  }, []);

  const navigation = [
    { name: "Agendamentos", href: "/dashboard", icon: CalendarIcon },
    { name: "Lista de Tarefas", href: "/dashboard/lista", icon: QueueListIcon },
    { name: "Alertas", href: "/dashboard/alertas", icon: BellAlertIcon },
    { name: "Relatórios", href: "/dashboard/relatorios", icon: ChartBarIcon },
    { name: "Configurações", href: "/dashboard/configuracoes", icon: Cog6ToothIcon },
  ];

  if (userEmail === "logistica@cymi.com.br") {
    navigation.splice(4, 0, { name: "Controle de Chaves", href: "/dashboard/chaves", icon: KeyIcon });
    navigation.push({ name: "Perfis", href: "/dashboard/usuarios", icon: UserGroupIcon });
    navigation.push({ name: "Veículos", href: "/dashboard/veiculos", icon: TruckIcon });
    navigation.push({ name: "Projetos/Fazendas", href: "/dashboard/fazendas", icon: MapIcon });
  }

  return (
    <div className="w-72 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-r border-white/40 dark:border-gray-800/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col hidden md:flex transition-all duration-300 z-10 relative">
      <div className="h-24 flex items-center px-8 border-b border-gray-100/50 dark:border-gray-800/50 bg-gradient-to-r from-[#0b7336]/10 to-transparent">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0b7336] to-[#298d4a] shadow-lg shadow-green-500/30 flex items-center justify-center">
            <span className="text-white font-bold text-xl tracking-tighter">C</span>
          </div>
          <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#0b7336] to-[#298d4a] tracking-tight">CYMI O&M</h2>
        </div>
      </div>
      
      <div className="px-6 py-4">
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 ml-2">Menu Principal</p>
        <nav className="flex-1 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  isActive
                    ? "bg-white dark:bg-gray-800 shadow-md shadow-gray-200/50 dark:shadow-none text-[#0b7336] dark:text-green-400 scale-[1.02]"
                    : "text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50 hover:text-gray-800 dark:hover:text-gray-200"
                } group flex items-center px-4 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-300 ease-in-out`}
              >
                <item.icon
                  className={`${
                    isActive ? "text-[#0b7336] dark:text-green-400" : "text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300"
                  } mr-4 flex-shrink-0 h-6 w-6 transition-colors duration-300`}
                  aria-hidden="true"
                />
                {item.name}
                {isActive && (
                  <div className="ml-auto w-1.5 h-6 bg-[#0b7336] dark:bg-green-400 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto px-6 py-6 border-t border-gray-100/50 dark:border-gray-800/50">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/";
          }}
          className="w-full flex items-center px-4 py-3.5 text-sm font-semibold rounded-2xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-300"
        >
          <ArrowRightOnRectangleIcon className="mr-4 flex-shrink-0 h-6 w-6" />
          Sair do Sistema
        </button>
      </div>
    </div>
  );
}
