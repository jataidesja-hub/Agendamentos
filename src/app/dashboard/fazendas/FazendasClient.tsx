"use client";

import { useEffect, useState, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  PlusCircleIcon,
  UserPlusIcon,
  EnvelopeIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ChevronDownIcon,
  UserIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

/* ─── Types ─────────────────────────────────────────────── */
interface Projeto {
  id: string;
  nome: string;
  created_at: string;
}

interface Contato {
  id: string;
  projeto_id: string;
  nome: string;
  email: string;
  tipo: 'admin' | 'gerente';
}

/* ─── Helpers ────────────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 transition-colors">
          <XMarkIcon className="w-5 h-5 text-gray-500" />
        </button>
        <h3 className="text-xl font-black text-gray-900 mb-6">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function ProjetosList() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showAddProjeto, setShowAddProjeto] = useState(false);
  const [showAddContato, setShowAddContato] = useState(false);
  const [showSendEmail, setShowSendEmail] = useState(false);

  // Form states
  const [novoProjeto, setNovoProjeto] = useState('');
  const [novoContatoNome, setNovoContatoNome] = useState('');
  const [novoContatoEmail, setNovoContatoEmail] = useState('');
  const [novoContatoTipo, setNovoContatoTipo] = useState<'admin' | 'gerente'>('gerente');
  const [novoContatoProjeto, setNovoContatoProjeto] = useState('');

  // Email form
  const [emailAssunto, setEmailAssunto] = useState('');
  const [emailCorpo, setEmailCorpo] = useState('');
  const [selectedProjetos, setSelectedProjetos] = useState<string[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [{ data: pData }, { data: cData }] = await Promise.all([
        supabase.from('projetos').select('*').order('nome'),
        supabase.from('projeto_contatos').select('*').order('nome'),
      ]);
      setProjetos(pData || []);
      setContatos(cData || []);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  /* ── CRUD Projeto ── */
  async function addProjeto() {
    if (!novoProjeto.trim()) return toast.error('Digite o nome do projeto');
    setSaving(true);
    const { error } = await supabase.from('projetos').insert({ nome: novoProjeto.trim() });
    setSaving(false);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Projeto criado!');
    setNovoProjeto('');
    setShowAddProjeto(false);
    fetchAll();
  }

  async function deleteProjeto(id: string) {
    if (!confirm('Deletar projeto e todos os contatos vinculados?')) return;
    await supabase.from('projetos').delete().eq('id', id);
    toast.success('Projeto removido');
    fetchAll();
  }

  /* ── CRUD Contato ── */
  async function addContato() {
    if (!novoContatoNome.trim() || !novoContatoEmail.trim() || !novoContatoProjeto)
      return toast.error('Preencha todos os campos');
    setSaving(true);
    const { error } = await supabase.from('projeto_contatos').insert({
      projeto_id: novoContatoProjeto,
      nome: novoContatoNome.trim(),
      email: novoContatoEmail.trim(),
      tipo: novoContatoTipo,
    });
    setSaving(false);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Contato adicionado!');
    setNovoContatoNome(''); setNovoContatoEmail(''); setNovoContatoProjeto('');
    setShowAddContato(false);
    fetchAll();
  }

  async function deleteContato(id: string) {
    await supabase.from('projeto_contatos').delete().eq('id', id);
    toast.success('Contato removido');
    fetchAll();
  }

  /* ── Send Email ── */
  async function sendEmail() {
    if (!emailAssunto.trim() || !emailCorpo.trim() || selectedProjetos.length === 0)
      return toast.error('Preencha assunto, corpo e selecione ao menos um projeto');
    setSendingEmail(true);

    const projetosSelecionados = projetos.filter(p => selectedProjetos.includes(p.id));
    const contatosFiltrados = contatos.filter(c => selectedProjetos.includes(c.projeto_id));
    const admins = contatosFiltrados.filter(c => c.tipo === 'admin');
    const gerentes = contatosFiltrados.filter(c => c.tipo === 'gerente');

    if (admins.length === 0) {
      setSendingEmail(false);
      return toast.error('Nenhum ADM encontrado nos projetos selecionados');
    }

    const listaGerentes = gerentes.length > 0
      ? `<ul style="margin:8px 0;padding-left:18px;">${gerentes.map(g => `<li>${g.nome} (${g.email})</li>`).join('')}</ul>`
      : '<p>Nenhum gerente vinculado.</p>';

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0b7336;">CYMI – Comunicado</h2>
        <p><strong>Projetos:</strong> ${projetosSelecionados.map(p => p.nome).join(', ')}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
        <div style="white-space:pre-wrap;">${emailCorpo}</div>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
        <p style="color:#888;font-size:12px;"><strong>Gerentes em cópia:</strong>${listaGerentes}</p>
      </div>`;

    const toList = admins.map(a => a.email).join(',');
    const ccList = gerentes.map(g => g.email).join(',');

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: toList, cc: ccList, subject: emailAssunto, html }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`E-mail enviado para ${admins.length} ADM(s)!`);
      setShowSendEmail(false);
      setEmailAssunto(''); setEmailCorpo(''); setSelectedProjetos([]);
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  }

  /* ── Filtered list ── */
  const filteredProjetos = useMemo(
    () => projetos.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase())),
    [projetos, searchTerm]
  );

  const toggleProjeto = (id: string) =>
    setSelectedProjetos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-8 w-full p-6">

      {/* Header */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Projetos</h2>
          <p className="text-gray-500 font-medium text-sm mt-1">{projetos.length} projeto(s) cadastrado(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-gray-50 border-0 rounded-2xl text-sm focus:ring-2 focus:ring-[#0b7336]/20 font-medium"
            />
          </div>
          {/* Buttons */}
          <button onClick={() => setShowAddProjeto(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#0b7336] text-white text-sm font-bold rounded-2xl hover:bg-[#0a6430] transition-colors shadow-lg shadow-green-500/20 whitespace-nowrap">
            <PlusCircleIcon className="w-5 h-5" /> Novo Projeto
          </button>
          <button onClick={() => setShowAddContato(true)}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-2xl hover:border-[#0b7336]/40 hover:text-[#0b7336] transition-colors whitespace-nowrap">
            <UserPlusIcon className="w-5 h-5" /> Adicionar Contato
          </button>
          <button onClick={() => setShowSendEmail(true)}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 whitespace-nowrap">
            <EnvelopeIcon className="w-5 h-5" /> Enviar E-mail
          </button>
        </div>
      </div>

      {/* Project Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-[2rem]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjetos.map(p => {
            const pContatos = contatos.filter(c => c.projeto_id === p.id);
            const admins = pContatos.filter(c => c.tipo === 'admin');
            const gerentes = pContatos.filter(c => c.tipo === 'gerente');
            return (
              <div key={p.id}
                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:border-[#0b7336]/30 hover:shadow-xl hover:shadow-[#0b7336]/5 transition-all group flex flex-col gap-4">
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-green-50 rounded-2xl group-hover:bg-[#0b7336] transition-colors shrink-0">
                      <MapPinIcon className="w-5 h-5 text-[#0b7336] group-hover:text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-gray-900 group-hover:text-[#0b7336] transition-colors uppercase leading-tight">{p.nome}</h4>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{pContatos.length} contato(s)</span>
                    </div>
                  </div>
                  <button onClick={() => deleteProjeto(p.id)} className="p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Admins */}
                {admins.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2 flex items-center gap-1">
                      <ShieldCheckIcon className="w-3.5 h-3.5" /> Administradores
                    </p>
                    {admins.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-1.5">
                        <div>
                          <p className="text-sm font-bold text-gray-700">{c.nome}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                        </div>
                        <button onClick={() => deleteContato(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Gerentes */}
                {gerentes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5" /> Gerentes
                    </p>
                    {gerentes.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-1.5">
                        <div>
                          <p className="text-sm font-bold text-gray-700">{c.nome}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                        </div>
                        <button onClick={() => deleteContato(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {pContatos.length === 0 && (
                  <p className="text-xs text-gray-300 font-medium text-center py-2">Nenhum contato vinculado</p>
                )}
              </div>
            );
          })}

          {filteredProjetos.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
              <p className="text-gray-400 font-bold">Nenhum projeto cadastrado. Clique em "Novo Projeto" para começar.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Novo Projeto ── */}
      {showAddProjeto && (
        <Modal title="Novo Projeto" onClose={() => setShowAddProjeto(false)}>
          <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Projeto</label>
          <input
            type="text"
            value={novoProjeto}
            onChange={e => setNovoProjeto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addProjeto()}
            placeholder="Ex: Fazenda Santa Maria"
            className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-[#0b7336]/20 font-medium"
          />
          <button onClick={addProjeto} disabled={saving}
            className="mt-6 w-full py-3 bg-[#0b7336] text-white font-bold rounded-2xl hover:bg-[#0a6430] transition-colors disabled:opacity-50">
            {saving ? 'Salvando...' : 'Criar Projeto'}
          </button>
        </Modal>
      )}

      {/* ── Modal: Novo Contato ── */}
      {showAddContato && (
        <Modal title="Adicionar Contato" onClose={() => setShowAddContato(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Projeto</label>
              <div className="relative">
                <select
                  value={novoContatoProjeto}
                  onChange={e => setNovoContatoProjeto(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-[#0b7336]/20 font-medium appearance-none pr-10">
                  <option value="">Selecione o projeto</option>
                  {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <ChevronDownIcon className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tipo</label>
              <div className="flex gap-3">
                {(['admin', 'gerente'] as const).map(t => (
                  <button key={t} onClick={() => setNovoContatoTipo(t)}
                    className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-colors capitalize ${novoContatoTipo === t ? 'bg-[#0b7336] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {t === 'admin' ? '🛡 Administrador' : '👤 Gerente'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nome</label>
              <input type="text" value={novoContatoNome} onChange={e => setNovoContatoNome(e.target.value)}
                placeholder="Nome completo"
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-[#0b7336]/20 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">E-mail</label>
              <input type="email" value={novoContatoEmail} onChange={e => setNovoContatoEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-[#0b7336]/20 font-medium" />
            </div>
            <button onClick={addContato} disabled={saving}
              className="mt-2 w-full py-3 bg-[#0b7336] text-white font-bold rounded-2xl hover:bg-[#0a6430] transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : 'Adicionar Contato'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Enviar E-mail ── */}
      {showSendEmail && (
        <Modal title="Enviar E-mail" onClose={() => setShowSendEmail(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Selecionar Projetos</label>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                {projetos.map(p => {
                  const selected = selectedProjetos.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => toggleProjeto(p.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors text-left ${selected ? 'bg-[#0b7336]/10 text-[#0b7336] border border-[#0b7336]/20' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-[#0b7336] border-[#0b7336]' : 'border-gray-300'}`}>
                        {selected && <CheckIcon className="w-3 h-3 text-white" />}
                      </div>
                      {p.nome}
                    </button>
                  );
                })}
                {projetos.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum projeto cadastrado</p>}
              </div>
            </div>

            {selectedProjetos.length > 0 && (
              <div className="bg-indigo-50 rounded-2xl px-4 py-3 text-xs text-indigo-700 font-medium">
                {(() => {
                  const sel = contatos.filter(c => selectedProjetos.includes(c.projeto_id));
                  const adm = sel.filter(c => c.tipo === 'admin');
                  const ger = sel.filter(c => c.tipo === 'gerente');
                  return `${adm.length} ADM(s) receberão o e-mail · ${ger.length} gerente(s) em cópia`;
                })()}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Assunto</label>
              <input type="text" value={emailAssunto} onChange={e => setEmailAssunto(e.target.value)}
                placeholder="Assunto do e-mail"
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-indigo-400/20 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Mensagem</label>
              <textarea value={emailCorpo} onChange={e => setEmailCorpo(e.target.value)}
                rows={5} placeholder="Digite a mensagem..."
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-indigo-400/20 font-medium resize-none" />
            </div>
            <button onClick={sendEmail} disabled={sendingEmail}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <EnvelopeIcon className="w-5 h-5" />
              {sendingEmail ? 'Enviando...' : 'Enviar E-mail'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
