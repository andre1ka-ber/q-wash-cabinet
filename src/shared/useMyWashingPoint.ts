import { useQuery } from '@tanstack/react-query';
import { useAuth, getWashingPoint } from 'q-wash-shared';

// Every screen in this app is scoped to the logged-in staff/worker's own
// point — App.tsx's RoleGate guarantees user.washing_point_id is set
// before any of this app's routes render, so the assertion here is safe.
export function useMyWashingPointId(): string {
  const { user } = useAuth();
  return user!.washing_point_id!;
}

export function useMyWashingPoint() {
  const washingPointId = useMyWashingPointId();
  return useQuery({
    queryKey: ['cabinet', 'washing-point', washingPointId],
    queryFn: () => getWashingPoint(washingPointId),
  });
}
