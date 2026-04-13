"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  BellAlertIcon,
  QueueListIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  KeyIcon,
  UserGroupIcon,
  TruckIcon,
  MapIcon,
  GlobeAmericasIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";
import { useState, useRef } from "react";
import { useNavigation } from "@/lib/useNavigation";

// Mapa de ícones
const iconMap: Record<string, any> = {
  CalendarIcon,
  QueueListIcon,
  BellAlertIcon,
  ChartBarIcon,
  GlobeAmericasIcon,
  Cog6ToothIcon,
  KeyIcon,
  UserGroupIcon,
  TruckIcon,
  MapIcon,
  ChartBarIcon2: ChartBarIcon,
  TruckIcon2: TruckIcon,
};

export default function Sidebar() {
  const pathname = usePathname();
  const { navigation, reorder } = useNavigation();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    // Necessário para Firefox
    e.dataTransfer.setData("text/plain", id);
    // Adiciona um delay para aplicar o estilo de dragging
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "0.4";
    }
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragId) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, toId: string) => {
    e.preventDefault();
    if (dragId && dragId !== toId) {
      reorder(dragId, toId);
    }
    setDragId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  return (
    <div className="w-72 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-r border-white/40 dark:border-gray-800/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col hidden md:flex transition-all duration-300 z-10 relative">
      <div className="h-24 flex items-center px-8 border-b border-gray-100/50 dark:border-gray-800/50 bg-gradient-to-r from-[#0b7336]/10 to-transparent">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0b7336] to-[#298d4a] shadow-lg shadow-green-500/30 flex items-center justify-center">
            <span className="text-white font-bold text-xl tracking-tighter">C</span>
          </div>
          <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#0b7336] to-[#298d4a] tracking-tighter">CYMI - Gerenciamentos</h2>
        </div>
      </div>
      
      <div className="px-6 py-4 flex-1 overflow-y-auto">
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 ml-2">Menu Principal</p>
        <nav className="flex-1 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = iconMap[item.iconName] || CalendarIcon;
            const isDragging = dragId === item.id;
            const isDragOver = dragOverId === item.id;

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, item.id)}
                onDragEnd={handleDragEnd}
                ref={isDragging ? dragNodeRef : null}
                className={`relative transition-all duration-200 ${
                  isDragging ? "opacity-40 scale-95" : "opacity-100"
                } ${
                  isDragOver ? "translate-y-1" : ""
                }`}
              >
                {/* Indicador de posição do drop */}
                {isDragOver && !isDragging && (
                  <div className="absolute -top-1 left-4 right-4 h-0.5 bg-[#0b7336] rounded-full z-20 shadow-[0_0_6px_rgba(11,115,54,0.5)]" />
                )}

                <Link
                  href={item.href}
                  className={`${
                    isActive
                      ? "bg-white dark:bg-gray-800 shadow-md shadow-gray-200/50 dark:shadow-none text-[#0b7336] dark:text-green-400 scale-[1.02]"
                      : "text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50 hover:text-gray-800 dark:hover:text-gray-200"
                  } group flex items-center px-4 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-300 ease-in-out`}
                >
                  {/* Grip handle */}
                  <Bars3Icon className="w-3.5 h-3.5 mr-2 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0" />
                  
                  <Icon
                    className={`${
                      isActive ? "text-[#0b7336] dark:text-green-400" : "text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300"
                    } mr-3 flex-shrink-0 h-6 w-6 transition-colors duration-300`}
                    aria-hidden="true"
                  />
                  {item.name}
                  {isActive && (
                    <div className="ml-auto w-1.5 h-6 bg-[#0b7336] dark:bg-green-400 rounded-full" />
                  )}
                </Link>
              </div>
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
