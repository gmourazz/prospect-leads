import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LeadsPage } from '@/pages/LeadsPage'
import { CampaignsPage } from '@/pages/CampaignsPage'
import { CampaignDetailPage } from '@/pages/CampaignDetailPage'
import { TemplatesPage } from '@/pages/TemplatesPage'
import { ImportPage } from '@/pages/ImportPage'
import { SearchLeadsPage } from '@/pages/SearchLeadsPage'
import { SegmentsPage } from '@/pages/SegmentsPage'
import { SuppressionPage } from '@/pages/SuppressionPage'
import { AwaitingReplyPage } from '@/pages/AwaitingReplyPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { QuotaPage } from '@/pages/QuotaPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
      { index: true, element: <DashboardPage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'campanhas', element: <CampaignsPage /> },
      { path: 'aguardando', element: <AwaitingReplyPage /> },
      { path: 'campanhas/:id', element: <CampaignDetailPage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'importar', element: <ImportPage /> },
      { path: 'buscar', element: <SearchLeadsPage /> },
      { path: 'segmentos', element: <SegmentsPage /> },
      { path: 'bloqueios', element: <SuppressionPage /> },
      { path: 'cota-busca', element: <QuotaPage /> },
      { path: 'configuracoes', element: <SettingsPage /> },
        ],
      },
    ],
  },
])
