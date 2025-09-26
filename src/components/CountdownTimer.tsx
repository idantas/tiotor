import { useCountdown } from '../hooks/useCountdown';

export default function CountdownTimer({ active }: { active: boolean }) {
  const { label } = useCountdown(300, active); // 5 minutos
  return (
    <div className="text-[22px] tracking-wide text-neutral-400 text-center select-none">
      Tempo restante: <span className="text-neutral-200 font-semibold">{label}</span>
    </div>
  );
}
