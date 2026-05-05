"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

const STATUS_STYLE: Record<string, string> = {
  OK: "bg-green-500 text-white",
  C: "bg-orange-500 text-white",
  F: "bg-red-500 text-white",
  V: "bg-blue-500 text-white",
  L: "bg-purple-500 text-white",
  SD: "bg-gray-400 text-white",
};

const FOTO_SPOTS = [
  { id: "farol_esq", label: "Farol Esquerdo" },
  { id: "farol_dir", label: "Farol Direito" },
  { id: "frente", label: "Frente" },
  { id: "lanterna_esq", label: "Lanterna Esquerda" },
  { id: "lanterna_dir", label: "Lanterna Direita" },
  { id: "tras", label: "Traseira" },
  { id: "lado_esq", label: "Lado Esquerdo" },
  { id: "lado_dir", label: "Lado Direito" },
  { id: "teto", label: "Teto" },
  { id: "interna_esq", label: "Interna Esquerda" },
  { id: "interna_meio", label: "Interna Meio" },
  { id: "interna_dir", label: "Interna Direita" },
  { id: "estepe", label: "Estepe" },
  { id: "mala", label: "Mala / Carroceria / Baú" },
  { id: "chave_roda", label: "Chave de Roda" },
  { id: "documento", label: "Documento do Veículo" },
  { id: "painel_km", label: "Painel com KM" },
  { id: "som", label: "Som" },
];

const GRUPOS = [
  { nome: "Iluminação", itens: [{ id: 1, label: "Lanternas dianteiras / traseiras" }, { id: 2, label: "Seta direita / Esquerda" }, { id: 3, label: "Estado Lente farol Dianteiro" }, { id: 4, label: "Luz baixa" }, { id: 5, label: "Luz Alta" }, { id: 6, label: "Luz de Freio" }, { id: 7, label: "Lanterna Traseira" }, { id: 8, label: "Luz de Ré" }, { id: 9, label: "Luz Interna" }, { id: 10, label: "Luz do Painel" }, { id: 11, label: "Alarme de Ré" }] },
  { nome: "Vidros e Visibilidade", itens: [{ id: 12, label: "Aspersos / Limpador pára-brisa" }, { id: 13, label: "Palheta limpador do pára brisa" }, { id: 14, label: "Pára-brisa" }, { id: 15, label: "Velocímetro" }, { id: 16, label: "Desembaçador interno" }, { id: 17, label: "Aquecedor" }] },
  { nome: "Interior", itens: [{ id: 18, label: "Portas" }, { id: 19, label: "Chaves Original e Reserva" }, { id: 20, label: "Assentos" }, { id: 21, label: "Manivelas e alavanca dos vidros" }, { id: 22, label: "Espelho retrovisor" }, { id: 23, label: "Cintos de segurança" }, { id: 24, label: "Aberturas / Teto solar" }, { id: 25, label: "Tapa-sol" }] },
  { nome: "Exterior", itens: [{ id: 26, label: "Estribos laterais" }, { id: 27, label: "Santo Antonio" }, { id: 28, label: "Proteção da frente" }, { id: 52, label: "Arranhões / riscos / pintura / amassados" }] },
  { nome: "Freios e Pneus", itens: [{ id: 29, label: "Freio de Mão" }, { id: 30, label: "Verificar estado dos Freios" }, { id: 31, label: "Estado dos Pneus" }, { id: 33, label: "Tipo / Medidas dos Pneus" }, { id: 34, label: "Verificar estado do Pneu de Estepe" }] },
  { nome: "Motor e Fluidos", itens: [{ id: 35, label: "Mangueiras do Motor" }, { id: 36, label: "Bateria / Capacidade" }, { id: 45, label: "Troca de Óleo Km." }, { id: 46, label: "Nível de óleo" }, { id: 47, label: "Funcionamento Ventoinha" }, { id: 48, label: "Vazamento óleo / água" }, { id: 49, label: "Barulhos estranhos" }] },
  { nome: "Segurança e Emergência", itens: [{ id: 37, label: "Tanque Combustível" }, { id: 38, label: "Chaves de Rodas" }, { id: 39, label: "Macaco" }, { id: 40, label: "Triangulo" }, { id: 41, label: "Extintor" }] },
  { nome: "Documentação", itens: [{ id: 42, label: "Documento de Veiculo" }, { id: 43, label: "Cartão Seguro" }, { id: 44, label: "Cartão Abastecimento" }] },
  { nome: "Carroceria e Acessórios", itens: [{ id: 32, label: "Mala" }, { id: 50, label: "Capota" }, { id: 51, label: "Vigia" }, { id: 53, label: "Radio Amador Frequencia CERON" }, { id: 54, label: "Aparelho de Som" }, { id: 55, label: "Veiculo é Individual" }, { id: 56, label: "Diferencial" }, { id: 57, label: "Dupla Tração" }, { id: 58, label: "Tapetes" }, { id: 59, label: "Cadeados Caixas Carroceria e Vara LV" }, { id: 60, label: "Escadas" }, { id: 61, label: "Grade de Carroceria para Escada" }, { id: 62, label: "Caixas de Ferramentas" }] },
  { nome: "Verificações Gerais", itens: [{ id: 63, label: "Verificar Condições dos Para-choques" }, { id: 64, label: "Verificar Fixação dos Paralamas" }, { id: 65, label: "Verificar Existência e Fechamento da Tampa de Combustível" }, { id: 66, label: "Verificar Existência de Placa de Ident. Dianteira e Traseira" }, { id: 67, label: "Verificar Existência de Iluminação e Lacre na Placa traseira" }, { id: 68, label: "Verificar se o Condutor Possue Habilitação Compatível e dentro da validade" }, { id: 69, label: "Verificar se o Condutor Possue de direção defensiva dentro da validade" }, { id: 70, label: "Verificar funcionamento do Ar Condicionado" }, { id: 71, label: "Verificar estado e funcionamento da Buzina" }] },
];

export default function VerChecklist() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("informe_checklist").select("*").eq("id", id).single().then(({ data }) => {
      setData(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#0b7336] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return <div className="text-center py-20 text-gray-400">Checklist não encontrado</div>;

  const respostas = data.respostas || {};
  const fotos = data.fotos || {};

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/dashboard/checklist")} className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Checklist — {data.placa}</h1>
          <p className="text-xs text-gray-500">{data.condutor} · {data.data_inspecao ? new Date(data.data_inspecao + "T12:00:00").toLocaleDateString("pt-BR") : ""}</p>
        </div>
      </div>

      {/* Dados */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4">
        <p className="text-xs font-black text-gray-500 uppercase mb-3">Dados do Veículo</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {[
            ["Placa", data.placa], ["KM", data.km], ["Condutor", data.condutor], ["CPF", data.cpf],
            ["Projeto", data.projeto], ["Centro de Custo", data.centro_custo], ["Tipo/Marca", data.tipo_marca],
            ["Modelo", data.modelo], ["Ano Fab.", data.ano_fab], ["Função", data.funcao],
            ["Data Inspeção", data.data_inspecao ? new Date(data.data_inspecao + "T12:00:00").toLocaleDateString("pt-BR") : ""],
            ["KM Inspeção", data.km_inspecao], ["Local", data.local_inspecao],
          ].filter(([, v]) => v).map(([label, val]) => (
            <div key={label as string}>
              <span className="text-[10px] font-bold text-gray-400 uppercase">{label}</span>
              <p className="font-bold text-gray-800 dark:text-white text-xs truncate">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      {GRUPOS.map(grupo => (
        <div key={grupo.nome} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50">
            <p className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-wider">{grupo.nome}</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
            {grupo.itens.map(item => {
              const resp = respostas[item.id];
              return (
                <div key={item.id} className="px-3 py-2.5 flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 w-5 shrink-0">{item.id}</span>
                  <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">{item.label}</span>
                  {resp?.situacao ? (
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${STATUS_STYLE[resp.situacao] || "bg-gray-200"}`}>
                      {resp.situacao}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-gray-100 dark:bg-gray-700 text-gray-400">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Fotos */}
      {Object.keys(fotos).length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4">
          <p className="text-xs font-black text-gray-500 uppercase mb-3">Fotos do Veículo</p>
          <div className="grid grid-cols-3 gap-2">
            {FOTO_SPOTS.filter(s => fotos[s.id]).map(spot => {
              const f = fotos[spot.id];
              return (
                <div key={spot.id} className="space-y-1">
                  <p className="text-[9px] font-bold text-gray-400 uppercase truncate">{spot.label}</p>
                  {f.sem_foto ? (
                    <div className="h-16 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-[9px] font-black text-gray-400">NÃO CONTEM</span>
                    </div>
                  ) : f.url ? (
                    <img
                      src={f.url}
                      alt={spot.label}
                      className="w-full h-16 object-cover rounded-xl cursor-pointer hover:opacity-90"
                      onClick={() => setFotoAmpliada(f.url)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <img src={fotoAmpliada} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
