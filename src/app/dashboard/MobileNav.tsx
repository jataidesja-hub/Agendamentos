"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, BellAlertIcon, QueueListIcon, ChartBarIcon, KeyIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MobileNav() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserEmail(session.user.email || null);
    });
  }, []);

  const navigation = [
    { name: "Agenda", href: "/dashboard", icon: CalendarIcon },
    { name: "Tarefas", href: "/dashboard/lista", icon: QueueListIcon },
    { name: "Alertas", href: "/dashboard/alertas", icon: BellAlertIcon },
    { name: "Painel", href: "/dashboard/relatorios", icon: ChartBarIcon },
  ];

  if (userEmail === "logistica@cymi.com.br") {
    navigation.splice(2, 0, { name: "Chaves", href: "/dashboard/chaves", icon: KeyIcon });
  }

  return (
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/40 dark:border-gray-800/50 shadow-2xl rounded-[2rem] px-2 py-3">
        <nav className="flex justify-around items-center">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 ${
                  isActive
                    ? "text-[#0b7336] dark:text-green-400 bg-green-50/50 dark:bg-green-500/10 scale-110"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                }`}
              >
                <item.icon className={`h-6 w-6 mb-1 ${isActive ? "stroke-2" : "stroke-1"}`} aria-hidden="true" />
                <span className={`text-[10px] font-bold ${isActive ? "opacity-100" : "opacity-0"}`}>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
