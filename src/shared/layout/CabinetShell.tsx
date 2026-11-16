import { Outlet } from 'react-router-dom';
import { color, useIsMobile } from 'q-wash-shared';
import { Header } from './Header';
import { MobileHeader } from './MobileHeader';
import { TabBar } from './TabBar';
import { useMyWashingPoint } from '../useMyWashingPoint';
import { PendingToast } from '../../features/booking-confirm/PendingParts';
import { PendingBookingsProvider } from '../../features/booking-confirm/usePendingBookings';

export function CabinetShell() {
  const pointQuery = useMyWashingPoint();
  const isMobile = useIsMobile();

  return (
    <PendingBookingsProvider>
    <div style={{ minHeight: '100vh', background: color.surface, display: 'flex', flexDirection: 'column' }}>
      {isMobile ? (
        <MobileHeader point={pointQuery.data} />
      ) : (
        <>
          <Header point={pointQuery.data} />
          <TabBar />
        </>
      )}
      <div style={{ flex: 1, padding: isMobile ? '20px 18px' : '28px 32px' }}>
        <Outlet />
      </div>
      <PendingToast mobile={isMobile} />
    </div>
    </PendingBookingsProvider>
  );
}
