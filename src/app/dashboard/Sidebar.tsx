"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, BellAlertIcon, QueueListIcon, ChartBarIcon } from "@heroicons/react/24/outline";

export default function Sidebar() {
  const pathname = usePathname();

  const navigation = [
    { name: "Agendamentos", href: "/dashboard", icon: CalendarIcon },
    { name: "Lista de Tarefas", href: "/dashboard/lista", icon: QueueListIcon },
    { name: "Alertas", href: "/dashboard/alertas", icon: BellAlertIcon },
    { name: "Relatórios", href: "/dashboard/relatorios", icon: ChartBarIcon },
  ];

  return (
    <div className="w-64 bg-white dark:bg-gray-800 shadow-md flex flex-col hidden md:flex border-r dark:border-gray-700">
      <div className="h-16 flex items-center px-6 border-b dark:border-gray-700 bg-gradient-to-r from-[#0b7336] to-[#298d4a]">
        <h2 className="text-xl font-bold text-white tracking-tight">CYMI O&M</h2>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`${
                isActive
                  ? "bg-green-50 dark:bg-gray-700 text-[#0b7336] dark:text-green-400"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              } group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors`}
            >
              <item.icon
                className={`${
                  isActive ? "text-[#0b7336] dark:text-green-400" : "text-gray-400 group-hover:text-gray-500"
                } mr-3 flex-shrink-0 h-6 w-6`}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t dark:border-gray-700">
        <Link 
          href="/" 
          className="flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
        >
          Sair do Sistema
        </Link>
      </div>
    </div>
  );
}
