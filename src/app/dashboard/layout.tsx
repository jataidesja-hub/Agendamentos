import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import InstallPrompt from "@/components/InstallPrompt";
import { MagnifyingGlassIcon, BellIcon } from "@heroicons/react/24/outline";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-screen bg-[#f4f7f5] dark:bg-[#0a0a0a] overflow-x-hidden selection:bg-[#0b7336] selection:text-white">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-[#0b7336]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-[#298d4a]/10 rounded-full blur-3xl pointer-events-none" />
      {/* Background Brasil Map */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" style={{ opacity: 0.30 }}>
        <img src="/bg-brasil-new.png" alt="" className="w-full h-full object-cover select-none" draggable={false} />
      </div>
      {/* Overlay to ensure readability */}
      <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-[2px] pointer-events-none z-0" />

      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative z-0">
        <header className="h-20 md:h-24 flex justify-between items-center px-4 md:px-8 bg-transparent transition-all duration-300">
          <div className="flex-1 flex items-center pr-2 md:pr-4 mt-2">
            <div className="relative w-full max-w-[200px] md:max-w-md hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-2.5 md:py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border-0 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#0b7336] shadow-sm transition-all duration-300 text-sm"
                placeholder="Pesquisar..."
              />
            </div>
            {/* Mobile Logo Placeholder or Title */}
            <div className="sm:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0b7336] to-[#298d4a] flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-xs">C</span>
              </div>
              <span className="font-black text-[#0b7336] text-sm tracking-tight">CYMI</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 md:space-x-6 mt-2">
            <button className="relative p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              <BellIcon className="h-6 w-6" />
              <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#f4f7f5] dark:ring-[#0a0a0a]" />
            </button>
            <div className="flex items-center space-x-2 md:space-x-3 cursor-pointer hover:opacity-80 transition-opacity bg-white/50 dark:bg-gray-800/50 backdrop-blur-md px-3 md:px-4 py-2 md:py-2.5 rounded-2xl shadow-sm">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-bold text-gray-800 dark:text-white">Admin</span>
                <span className="text-xs font-medium text-gray-500">O&M</span>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-[#0b7336] to-[#09602c] text-white flex items-center justify-center font-bold shadow-md text-xs md:text-base">
                AD
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pt-4 pb-28 md:pb-8">
          <div className="w-full h-full">
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
      <InstallPrompt />
    </div>
  );
}
