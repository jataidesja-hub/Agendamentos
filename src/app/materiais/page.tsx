"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import MateriaisApp from './MateriaisApp';
import { useRouter } from 'next/navigation';

export default function MateriaisPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Verifica permissão
        const email = session.user.email || "";
        if (email === "logistica@cymi.com.br") {
          setIsAdmin(true);
        } else {
          const { data } = await supabase
            .from("perfis_acesso")
            .select("telas_acesso")
            .eq("email", email)
            .single();
          if (data?.telas_acesso?.includes("materiais")) {
            setIsAdmin(true);
          }
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#0b7336] border-t-transparent rounded-full" /></div>;

  return <MateriaisApp isAdmin={isAdmin} />;
}
