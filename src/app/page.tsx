import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        {/* Left Side: Branding / Background */}
        <div className="md:w-1/2 p-8 flex flex-col items-center justify-center relative bg-gradient-to-br from-[#0b7336] to-[#298d4a] text-white">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "url('mapa-brasil-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }}></div>
          <div className="z-10 text-center">
            <h1 className="text-4xl font-bold mb-4 tracking-tight">CYMI O&M</h1>
            <p className="text-lg opacity-90 text-green-100">
              Sistema Inteligente de Agendamento
            </p>
          </div>
        </div>

        {/* Right Side: Login / Access */}
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Acesse sua conta</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Gerencie suas datas, prioridades e alertas.</p>
          </div>

          <form className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                E-mail Profissional
              </label>
              <input 
                type="email" 
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#0b7336] focus:border-transparent transition-all outline-none"
                placeholder="nome@cymi.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Senha
              </label>
              <input 
                type="password" 
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#0b7336] focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
              />
              <div className="text-right mt-2">
                <a href="#" className="text-sm text-[#0b7336] hover:text-[#298d4a] font-medium transition-colors">
                  Esqueceu a senha?
                </a>
              </div>
            </div>

            <button 
              type="button" 
              className="w-full py-3 px-4 bg-[#0b7336] hover:bg-[#09602c] text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 mt-4"
            >
              Entrar no Sistema
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>&copy; 2026 CYMI O&M. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
