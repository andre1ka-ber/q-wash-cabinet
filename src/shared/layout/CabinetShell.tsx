import { Outlet } from 'react-router-dom';
import { color } from 'q-wash-shared';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { useMyWashingPoint } from '../useMyWashingPoint';

export function CabinetShell() {
  const pointQuery = useMyWashingPoint();

  return (
    <div style={{ minHeight: '100vh', background: color.surface, display: 'flex', flexDirection: 'column' }}>
      <Header point={pointQuery.data} />
      <TabBar />
      <div style={{ flex: 1, padding: '28px 32px' }}>
        <Outlet />
      </div>
    </div>
  );
}
