"use client";

import { useEffect, useState, useMemo } from 'react';
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
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

/* ─── Types ────────────────────────────────────────── */
interface Projeto { id: string; nome: string; }
interface Contato { id: string; nome: string; email: string; tipo: 'admin' | 'gerente'; }
interface ContatoProjeto { contato_id: string; projeto_id: string; }

/* ─── Modal wrapper ────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 transition-colors">
          <XMarkIcon className="w-5 h-5 text-gray-500" />
        </button>
        <h3 className="text-xl font-black text-gray-900 mb-6">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ─── Checkbox list for projects ───────────────────── */
function ProjetosCheckbox({ projetos, selected, onChange }: {
  projetos: Projeto[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
      {projetos.map(p => {
        const sel = selected.includes(p.id);
        return (
          <button key={p.id} type="button" onClick={() => toggle(p.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors text-left ${sel ? 'bg-[#0b7336]/10 text-[#0b7336] border border-[#0b7336]/20' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 ${sel ? 'bg-[#0b7336] border-[#0b7336]' : 'border-gray-300'}`}>
              {sel && <CheckIcon className="w-3 h-3 text-white" />}
            </div>
            {p.nome}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────── */
export default function ProjetosList() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [links, setLinks] = useState<ContatoProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal visibility
  const [modal, setModal] = useState<'projeto' | 'contato' | 'email' | 'editProjeto' | 'editContato' | null>(null);

  // Projeto form
  const [projetoNome, setProjetoNome] = useState('');
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);

  // Contato form
  const [contatoNome, setContatoNome] = useState('');
  const [contatoEmail, setContatoEmail] = useState('');
  const [contatoTipo, setContatoTipo] = useState<'admin' | 'gerente'>('gerente');
  const [contatoProjetos, setContatoProjetos] = useState<string[]>([]);
  const [editingContato, setEditingContato] = useState<Contato | null>(null);

  // Email form
  const [emailProjetos, setEmailProjetos] = useState<string[]>([]);
  const [emailAssunto, setEmailAssunto] = useState('');
  const [emailCorpo, setEmailCorpo] = useState('');

  /* ── Fetch ── */
  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: p }, { data: c }, { data: l }] = await Promise.all([
      supabase.from('projetos').select('*').order('nome'),
      supabase.from('contatos').select('*').order('nome'),
      supabase.from('contato_projetos').select('*'),
    ]);
    setProjetos(p || []);
    setContatos(c || []);
    setLinks(l || []);
    setLoading(false);
  }

  /* ── Projeto CRUD ── */
  async function saveProjeto() {
    if (!projetoNome.trim()) return toast.error('Digite o nome');
    setSaving(true);
    if (editingProjeto) {
      const { error } = await supabase.from('projetos').update({ nome: projetoNome.trim() }).eq('id', editingProjeto.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Projeto atualizado!');
    } else {
      const { error } = await supabase.from('projetos').insert({ nome: projetoNome.trim() });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Projeto criado!');
    }
    setSaving(false);
    resetAndClose();
    fetchAll();
  }

  async function deleteProjeto(id: string) {
    if (!confirm('Deletar projeto?')) return;
    await supabase.from('projetos').delete().eq('id', id);
    toast.success('Projeto removido');
    fetchAll();
  }

  function openEditProjeto(p: Projeto) {
    setEditingProjeto(p);
    setProjetoNome(p.nome);
    setModal('editProjeto');
  }

  /* ── Contato CRUD ── */
  async function saveContato() {
    if (!contatoNome.trim() || !contatoEmail.trim()) return toast.error('Preencha nome e e-mail');
    if (contatoProjetos.length === 0) return toast.error('Selecione ao menos um projeto');
    setSaving(true);

    if (editingContato) {
      // Update contato
      const { error } = await supabase.from('contatos').update({
        nome: contatoNome.trim(), email: contatoEmail.trim(), tipo: contatoTipo,
      }).eq('id', editingContato.id);
      if (error) { toast.error(error.message); setSaving(false); return; }

      // Rewrite links
      await supabase.from('contato_projetos').delete().eq('contato_id', editingContato.id);
      await supabase.from('contato_projetos').insert(
        contatoProjetos.map(pid => ({ contato_id: editingContato.id, projeto_id: pid }))
      );
      toast.success('Contato atualizado!');
    } else {
      const { data: newC, error } = await supabase.from('contatos')
        .insert({ nome: contatoNome.trim(), email: contatoEmail.trim(), tipo: contatoTipo })
        .select().single();
      if (error || !newC) { toast.error(error?.message || 'Erro'); setSaving(false); return; }

      await supabase.from('contato_projetos').insert(
        contatoProjetos.map(pid => ({ contato_id: newC.id, projeto_id: pid }))
      );
      toast.success('Contato adicionado!');
    }

    setSaving(false);
    resetAndClose();
    fetchAll();
  }

  async function deleteContato(id: string) {
    if (!confirm('Deletar contato?')) return;
    await supabase.from('contatos').delete().eq('id', id);
    toast.success('Contato removido');
    fetchAll();
  }

  function openEditContato(c: Contato) {
    setEditingContato(c);
    setContatoNome(c.nome);
    setContatoEmail(c.email);
    setContatoTipo(c.tipo);
    setContatoProjetos(links.filter(l => l.contato_id === c.id).map(l => l.projeto_id));
    setModal('editContato');
  }

  function openAddContato() {
    setEditingContato(null);
    setContatoNome(''); setContatoEmail(''); setContatoTipo('gerente'); setContatoProjetos([]);
    setModal('contato');
  }

  /* ── Reset ── */
  function resetAndClose() {
    setModal(null);
    setProjetoNome(''); setEditingProjeto(null);
    setContatoNome(''); setContatoEmail(''); setContatoTipo('gerente'); setContatoProjetos([]); setEditingContato(null);
    setEmailProjetos([]); setEmailAssunto(''); setEmailCorpo('');
  }

  /* ── Send Email via mailto ── */
  function openMailto() {
    if (emailProjetos.length === 0) return toast.error('Selecione ao menos um projeto');
    if (!emailAssunto.trim() || !emailCorpo.trim()) return toast.error('Preencha assunto e mensagem');

    const contatosDoProjeto = links
      .filter(l => emailProjetos.includes(l.projeto_id))
      .map(l => contatos.find(c => c.id === l.contato_id))
      .filter(Boolean) as Contato[];

    const uniq = (arr: Contato[]) => [...new Map(arr.map(c => [c.id, c])).values()];
    const admins = uniq(contatosDoProjeto.filter(c => c.tipo === 'admin'));
    const gerentes = uniq(contatosDoProjeto.filter(c => c.tipo === 'gerente'));

    if (admins.length === 0) return toast.error('Nenhum ADM nos projetos selecionados');

    const projetosNomes = projetos.filter(p => emailProjetos.includes(p.id)).map(p => p.nome).join(', ');
    const corpoFinal = `${emailCorpo}\n\n---\nProjetos: ${projetosNomes}\nGerentes em cópia: ${gerentes.map(g => g.nome + ' <' + g.email + '>').join(', ') || 'Nenhum'}`;

    const to = admins.map(a => a.email).join(',');
    const cc = gerentes.map(g => g.email).join(',');
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?${cc ? `cc=${encodeURIComponent(cc)}&` : ''}subject=${encodeURIComponent(emailAssunto)}&body=${encodeURIComponent(corpoFinal)}`;

    window.open(mailtoUrl, '_blank');
    resetAndClose();
  }

  /* ── Derived ── */
  const filteredProjetos = useMemo(
    () => projetos.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase())),
    [projetos, searchTerm]
  );

  function getContatosDoProjeto(projetoId: string) {
    const ids = links.filter(l => l.projeto_id === projetoId).map(l => l.contato_id);
    return contatos.filter(c => ids.includes(c.id));
  }

  /* ─── Render ───────────────────────────────────────── */
  const contatoModalTitle = modal === 'editContato' ? 'Editar Contato' : 'Adicionar Contato';

  return (
    <div className="flex flex-col gap-8 w-full p-6">

      {/* Header */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Projetos</h2>
          <p className="text-gray-500 font-medium text-sm mt-1">{projetos.length} projeto(s) cadastrado(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 min-w-[180px]">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-gray-50 border-0 rounded-2xl text-sm focus:ring-2 focus:ring-[#0b7336]/20 font-medium" />
          </div>
          <button onClick={() => { setEditingProjeto(null); setProjetoNome(''); setModal('projeto'); }}
            className="flex items-center gap-2 px-5 py-3 bg-[#0b7336] text-white text-sm font-bold rounded-2xl hover:bg-[#0a6430] transition-colors shadow-lg shadow-green-500/20 whitespace-nowrap">
            <PlusCircleIcon className="w-5 h-5" /> Novo Projeto
          </button>
          <button onClick={openAddContato}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-2xl hover:border-[#0b7336]/40 hover:text-[#0b7336] transition-colors whitespace-nowrap">
            <UserPlusIcon className="w-5 h-5" /> Adicionar Contato
          </button>
          <button onClick={() => setModal('email')}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 whitespace-nowrap">
            <EnvelopeIcon className="w-5 h-5" /> Enviar E-mail
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-[2rem]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjetos.map(p => {
            const pContatos = getContatosDoProjeto(p.id);
            const admins = pContatos.filter(c => c.tipo === 'admin');
            const gerentes = pContatos.filter(c => c.tipo === 'gerente');
            return (
              <div key={p.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:border-[#0b7336]/30 hover:shadow-xl hover:shadow-[#0b7336]/5 transition-all group flex flex-col gap-4">
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
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditProjeto(p)} className="p-2 rounded-xl hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteProjeto(p.id)} className="p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

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
                        <div className="flex gap-1">
                          <button onClick={() => openEditContato(c)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-400 transition-colors">
                            <PencilSquareIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteContato(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

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
                        <div className="flex gap-1">
                          <button onClick={() => openEditContato(c)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-400 transition-colors">
                            <PencilSquareIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteContato(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
              <p className="text-gray-400 font-bold">Nenhum projeto. Clique em "Novo Projeto".</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Projeto (criar/editar) ── */}
      {(modal === 'projeto' || modal === 'editProjeto') && (
        <Modal title={modal === 'editProjeto' ? 'Editar Projeto' : 'Novo Projeto'} onClose={resetAndClose}>
          <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Projeto</label>
          <input type="text" value={projetoNome} onChange={e => setProjetoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveProjeto()}
            placeholder="Ex: Fazenda Santa Maria"
            className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-[#0b7336]/20 font-medium" />
          <button onClick={saveProjeto} disabled={saving}
            className="mt-6 w-full py-3 bg-[#0b7336] text-white font-bold rounded-2xl hover:bg-[#0a6430] transition-colors disabled:opacity-50">
            {saving ? 'Salvando...' : modal === 'editProjeto' ? 'Salvar Alterações' : 'Criar Projeto'}
          </button>
        </Modal>
      )}

      {/* ── Modal: Contato (criar/editar) ── */}
      {(modal === 'contato' || modal === 'editContato') && (
        <Modal title={contatoModalTitle} onClose={resetAndClose}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tipo</label>
              <div className="flex gap-3">
                {(['admin', 'gerente'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setContatoTipo(t)}
                    className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-colors ${contatoTipo === t ? 'bg-[#0b7336] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {t === 'admin' ? '🛡 Administrador' : '👤 Gerente'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nome</label>
              <input type="text" value={contatoNome} onChange={e => setContatoNome(e.target.value)}
                placeholder="Nome completo"
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-[#0b7336]/20 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">E-mail</label>
              <input type="email" value={contatoEmail} onChange={e => setContatoEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-[#0b7336]/20 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Projetos vinculados</label>
              <ProjetosCheckbox projetos={projetos} selected={contatoProjetos} onChange={setContatoProjetos} />
            </div>
            <button onClick={saveContato} disabled={saving}
              className="mt-2 w-full py-3 bg-[#0b7336] text-white font-bold rounded-2xl hover:bg-[#0a6430] transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : modal === 'editContato' ? 'Salvar Alterações' : 'Adicionar Contato'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Enviar E-mail ── */}
      {modal === 'email' && (
        <Modal title="Enviar E-mail" onClose={resetAndClose}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Selecionar Projetos</label>
              <ProjetosCheckbox projetos={projetos} selected={emailProjetos} onChange={setEmailProjetos} />
            </div>

            {emailProjetos.length > 0 && (() => {
              const sel = links.filter(l => emailProjetos.includes(l.projeto_id)).map(l => contatos.find(c => c.id === l.contato_id)).filter(Boolean) as Contato[];
              const uniq = (arr: Contato[]) => [...new Map(arr.map(c => [c.id, c])).values()];
              const adm = uniq(sel.filter(c => c.tipo === 'admin'));
              const ger = uniq(sel.filter(c => c.tipo === 'gerente'));
              return (
                <div className="bg-indigo-50 rounded-2xl px-4 py-3 text-xs text-indigo-700 font-medium">
                  {adm.length} ADM(s) receberão · {ger.length} gerente(s) em cópia
                </div>
              );
            })()}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Assunto</label>
              <input type="text" value={emailAssunto} onChange={e => setEmailAssunto(e.target.value)}
                placeholder="Assunto do e-mail"
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-indigo-400/20 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Mensagem</label>
              <textarea value={emailCorpo} onChange={e => setEmailCorpo(e.target.value)} rows={5}
                placeholder="Digite a mensagem..."
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-indigo-400/20 font-medium resize-none" />
            </div>
            <button onClick={openMailto}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
              <EnvelopeIcon className="w-5 h-5" /> Abrir no E-mail
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
