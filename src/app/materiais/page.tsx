import MateriaisApp from './MateriaisApp';

export const metadata = {
  title: 'Controle de Materiais - CYMI',
};

export default function MateriaisPage() {
  return <MateriaisApp isAdmin={false} />;
}
