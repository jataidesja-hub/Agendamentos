import MateriaisApp from '../../materiais/MateriaisApp';

export const metadata = {
  title: 'Gerenciamento de Materiais - Dashboard CYMI',
};

export default function MateriaisDashboardPage() {
  return <MateriaisApp isAdmin={true} />;
}
