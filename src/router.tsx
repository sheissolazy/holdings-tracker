import { createHashRouter } from 'react-router-dom'
import Layout from './components/Layout'
import Briefing from './pages/Briefing'
import TradePlan from './pages/TradePlan'
import PersonDetail from './pages/PersonDetail'
import StockDetail from './pages/StockDetail'
import Holdings from './pages/Holdings'
import Analysis from './pages/Analysis'
import News from './pages/News'
import IPOs from './pages/IPOs'
import Settings from './pages/Settings'
import Stub from './pages/Stub'

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Briefing /> },
      { path: 'plan', element: <TradePlan /> },
      { path: 'person/:id', element: <PersonDetail /> },
      { path: 'holdings/:id', element: <Holdings /> },
      { path: 'stock/:ticker', element: <StockDetail /> },
      { path: 'analysis/:ticker', element: <Analysis /> },
      { path: 'news', element: <News /> },
      { path: 'ipos', element: <IPOs /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Stub title="404" note="页面不存在" /> },
    ],
  },
])
